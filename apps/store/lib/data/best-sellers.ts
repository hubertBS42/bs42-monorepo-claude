import "server-only"

import { unstable_cache } from "next/cache"
import { prisma } from "@workspace/db"

// How far back the homepage's best sellers look
export const BEST_SELLERS_DAYS = 90
// How many different customers must have bought a product in that time for it to count: below that, a row of best
// sellers is a few orders' noise (one hotel's reorders), so the row hides until there are enough
export const BEST_SELLERS_MIN_CUSTOMERS = 5

// Products by how many different customers bought them in the last BEST_SELLERS_DAYS (paid as the console's dashboard
// counts it, not cancelled), most first, then by orders. A customer is the order's email, else its phone, else its
// account, so one buyer's repeat orders count once. Ids only: the homepage loads the cards, which keeps only what's on
// sale. Counting distinct customers across an order's columns is beyond Prisma's groupBy, so it's SQL. Cached for an
// hour: it moves slowly.
export const getBestSellerIds = unstable_cache(
  async (): Promise<string[]> => {
    const since = new Date(Date.now() - BEST_SELLERS_DAYS * 86_400_000)
    const rows = await prisma.$queryRaw<{ productId: string }[]>`
      SELECT i."productId"
      FROM "order_item" i JOIN "order" o ON o."id" = i."orderId"
      WHERE i."productId" IS NOT NULL AND o."paidAt" >= ${since}
        AND o."paymentStatus" NOT IN ('PENDING', 'FAILED') AND o."status" <> 'CANCELLED'
      GROUP BY i."productId"
      HAVING count(DISTINCT COALESCE(lower(nullif(o."customerEmail", '')), nullif(o."customerPhone", ''), o."userId"::text, o."id"::text)) >= ${BEST_SELLERS_MIN_CUSTOMERS}
      ORDER BY count(DISTINCT COALESCE(lower(nullif(o."customerEmail", '')), nullif(o."customerPhone", ''), o."userId"::text, o."id"::text)) DESC,
               count(DISTINCT o."id") DESC
      -- More than the row shows: some won't be on sale, in stock or new to the visitor (already featured)
      LIMIT 40`
    return rows.map((row) => row.productId)
  },
  ["store-best-seller-ids-by-customers"],
  { revalidate: 3600 }
)
