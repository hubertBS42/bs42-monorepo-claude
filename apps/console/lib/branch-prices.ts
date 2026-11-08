import "server-only"

import type { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"

// A branch group's stores sell a product at the same prices: saving a listing's sell or compare-at price, or a
// variant's sell price, sets the same at the group's other branches that list it, and a branch listing a product
// another branch sells starts at that branch's prices. Stock, buy prices, alerts and statuses stay each branch's own.
// In its own module, with relative imports, so it can be tested against the database.

type Client = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface ListingPrices {
  sellPrice: Prisma.Decimal | number
  compareAtPrice: Prisma.Decimal | number | null
  // By catalogue variant id; null sells at the listing's price
  variants: Map<string, Prisma.Decimal | number | null>
}

// The store's group's name, or null when it's in none
export async function branchGroupName(client: Client, storeId: string) {
  const membership = await client.branchMembership.findUnique({ where: { organizationId: storeId }, select: { group: { select: { name: true } } } })
  return membership?.group.name ?? null
}

// The other stores in the store's group
export async function otherBranchIds(client: Client, storeId: string): Promise<string[]> {
  const membership = await client.branchMembership.findUnique({ where: { organizationId: storeId }, select: { groupId: true } })
  if (!membership) return []
  const others = await client.branchMembership.findMany({ where: { groupId: membership.groupId, organizationId: { not: storeId } }, select: { organizationId: true } })
  return others.map((row) => row.organizationId)
}

// The prices the group's other branches sell the product at, if any lists it (they're the same, so the oldest listing's)
export async function branchPrices(client: Client, storeId: string, productId: string): Promise<ListingPrices | null> {
  const others = await otherBranchIds(client, storeId)
  if (!others.length) return null
  const listing = await client.storeListing.findFirst({
    where: { organizationId: { in: others }, productId },
    orderBy: { createdAt: "asc" },
    select: { sellPrice: true, compareAtPrice: true, storeListingVariants: { select: { variantId: true, sellPrice: true } } },
  })
  if (!listing) return null
  return { sellPrice: listing.sellPrice, compareAtPrice: listing.compareAtPrice, variants: new Map(listing.storeListingVariants.map((row) => [row.variantId, row.sellPrice])) }
}

// Sets the prices at the group's other branches that list the product; the number of branches it changed. Their edit
// forms then answer CONFLICT on save, as for any change made meanwhile.
export async function syncBranchPrices(tx: Client, storeId: string, productId: string, prices: ListingPrices) {
  const others = await otherBranchIds(tx, storeId)
  if (!others.length) return 0
  const { count } = await tx.storeListing.updateMany({
    where: { organizationId: { in: others }, productId },
    data: { sellPrice: prices.sellPrice, compareAtPrice: prices.compareAtPrice },
  })
  for (const [variantId, sellPrice] of prices.variants) {
    await tx.storeListingVariant.updateMany({ where: { variantId, storeListing: { organizationId: { in: others }, productId } }, data: { sellPrice } })
  }
  return count
}
