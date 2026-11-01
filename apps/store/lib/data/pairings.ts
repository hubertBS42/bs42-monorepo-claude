import "server-only"

import { unstable_cache } from "next/cache"
import { prisma } from "@workspace/db"

// The product's "pairs well with" list: its own if it has one, else the nearest category's up the tree (categoryIds,
// nearest first) that has one. Ids only, in the list's order; the page loads their cards, which leaves out what isn't
// on sale. Cached for a minute like the rest of the storefront.
export const getPairedProductIds = unstable_cache(
  async (productId: string, categoryIds: string[]): Promise<string[]> => {
    const rows = await prisma.productPairing.findMany({
      where: { OR: [{ productId }, { categoryId: { in: categoryIds } }] },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { productId: true, categoryId: true, pairedProductId: true },
    })
    const own = rows.filter((row) => row.productId === productId)
    const list = own.length ? own : (categoryIds.map((id) => rows.filter((row) => row.categoryId === id)).find((category) => category.length) ?? [])
    return list.map((row) => row.pairedProductId).filter((id) => id !== productId)
  },
  ["store-pairings"],
  { revalidate: 60 }
)
