import "server-only"

import { unstable_cache } from "next/cache"
import { prisma } from "@workspace/db"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"

// How far back the homepage's best sellers look
export const BEST_SELLERS_DAYS = 90

// Products by how many paid orders had them in the last BEST_SELLERS_DAYS (paid as the console's dashboard counts it,
// not cancelled), most first. By orders, not units, so one bulk order doesn't top the list. Ids only: the homepage
// loads the cards, which keeps only what's on sale. Cached for an hour: it moves slowly.
export const getBestSellerIds = unstable_cache(
  async (): Promise<string[]> => {
    const since = new Date(Date.now() - BEST_SELLERS_DAYS * 86_400_000)
    const rows = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        order: { paidAt: { gte: since }, paymentStatus: { notIn: [PaymentStatus.PENDING, PaymentStatus.FAILED] }, status: { not: OrderStatus.CANCELLED } },
      },
      _count: { orderId: true },
      orderBy: { _count: { orderId: "desc" } },
      // More than the row shows: some won't be on sale, in stock or new to the visitor (already featured)
      take: 40,
    })
    return rows.flatMap((row) => (row.productId ? [row.productId] : []))
  },
  ["store-best-seller-ids"],
  { revalidate: 3600 }
)
