import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { customerVisibleListingWhere, loadVisibleCategoryIds } from "@workspace/commerce/visibility"
import type { ListingBuyPriceState } from "../types"

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Listings whose buy price would make the profit report wrong: missing (the line counts in no profit) or not below the
// sell price (no margin, or a loss), checked on what's sold: the listing without variants, else each variant on sale,
// with a variant's own prices or else the listing's. Prices of 0 count as none, as the forms show them. That compares
// a variant's prices with its listing's, which Prisma's filters can't, so it's SQL.
export async function getListingIdsWithBuyPriceState(tx: Tx, storeId: string, state: ListingBuyPriceState): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    WITH items AS (
      SELECT l."id" AS "listingId", NULLIF(l."buyPrice", 0) AS "buy", l."sellPrice" AS "sell"
      FROM "store_listing" l JOIN "product" p ON p."id" = l."productId"
      WHERE NOT p."hasVariants" AND l."organizationId" = ${storeId}::uuid
      UNION ALL
      SELECT l."id", COALESCE(NULLIF(v."buyPrice", 0), NULLIF(l."buyPrice", 0)), COALESCE(v."sellPrice", l."sellPrice")
      FROM "store_listing" l
      JOIN "product" p ON p."id" = l."productId"
      JOIN "store_listing_variant" v ON v."storeListingId" = l."id"
      JOIN "product_variant" pv ON pv."id" = v."variantId"
      WHERE p."hasVariants" AND v."status" = 'PUBLISHED' AND pv."status" <> 'ARCHIVED' AND l."organizationId" = ${storeId}::uuid
    )
    SELECT DISTINCT "listingId" AS "id" FROM items
    WHERE "sell" > 0 AND ${state === "missing" ? Prisma.sql`"buy" IS NULL` : state === "notBelow" ? Prisma.sql`"buy" >= "sell"` : Prisma.sql`("buy" IS NULL OR "buy" >= "sell")`}`
  return rows.map((row) => row.id)
}

// How many listings customers can buy have a buy price to fix, for the dashboard
export async function countBuyPricesToFix(tx: Tx, storeId: string): Promise<number> {
  const [ids, visibleCategoryIds] = await Promise.all([getListingIdsWithBuyPriceState(tx, storeId, "toFix"), loadVisibleCategoryIds(tx)])
  if (ids.length === 0) return 0
  return tx.storeListing.count({ where: { AND: [{ id: { in: ids } }, customerVisibleListingWhere(visibleCategoryIds)] } })
}
