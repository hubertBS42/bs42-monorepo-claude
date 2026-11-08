import type { prisma } from "@workspace/db"
import { customerVisibleListingWhere, loadVisibleCategoryIds, variantOnSaleWhere } from "./visibility"

// Where pickups are collected: each store's pickup location (a branch), which an order copies when it's made. In its
// own module, with relative imports, so scripts can run it like the rest.

type Client = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface PickupLocationView {
  name: string
  address: string
  hours: string | null
  phone: string | null
  mapUrl: string | null
}

export const pickupLocationSelect = { name: true, address: true, hours: true, phone: true, mapUrl: true } as const

// A location a customer can choose
export type PickupOption = PickupLocationView & { id: string }

// The location a pickup of these stores' items is collected from: only items all from one store, which has one
export async function pickupLocationForStores(client: Client, storeIds: (string | null)[]): Promise<PickupOption | null> {
  const ids = [...new Set(storeIds.filter((id): id is string => !!id))]
  if (ids.length !== 1) return null
  return client.pickupLocation.findUnique({ where: { organizationId: ids[0] }, select: { id: true, ...pickupLocationSelect } })
}

export interface PickupLine {
  listingId: string
  listingVariantId: string | null
  quantity: number
  installation: boolean
}

// Where a basket can be collected, and how: each location whose own store sells everything in it, on sale and in
// stock for the quantity, with the lines as that store's listings (the same product and variant). Collecting there
// sells that store's stock at its prices, whichever store the basket held each line at. Nothing installed: the
// installers go to an address. Bringing items from another branch to the location comes later.
export async function pickupOptions(client: Client, lines: PickupLine[]): Promise<{ location: PickupOption; lines: PickupLine[] }[]> {
  if (!lines.length || lines.some((line) => line.installation)) return []
  const locations = await client.pickupLocation.findMany({ orderBy: { name: "asc" }, select: { id: true, organizationId: true, ...pickupLocationSelect } })
  if (!locations.length) return []

  // What each line is: its product and its catalogue variant. One query after another: a transaction has one connection.
  const listings = await client.storeListing.findMany({ where: { id: { in: lines.map((line) => line.listingId) } }, select: { id: true, productId: true } })
  const variants = await client.storeListingVariant.findMany({ where: { id: { in: lines.flatMap((line) => line.listingVariantId ?? []) } }, select: { id: true, variantId: true } })
  const visibleCategoryIds = await loadVisibleCategoryIds(client)
  const productOf = new Map(listings.map((listing) => [listing.id, listing.productId]))
  const variantOf = new Map(variants.map((variant) => [variant.id, variant.variantId]))
  const productIds = [...new Set(listings.map((listing) => listing.productId))]

  const options: { location: PickupOption; lines: PickupLine[] }[] = []
  for (const { organizationId, ...location } of locations) {
    const offered = await client.storeListing.findMany({
      where: { AND: [customerVisibleListingWhere(visibleCategoryIds), { organizationId, productId: { in: productIds } }] },
      select: {
        id: true,
        productId: true,
        stock: true,
        trackInventory: true,
        storeListingVariants: { where: variantOnSaleWhere, select: { id: true, variantId: true, stock: true, trackInventory: true } },
      },
    })
    const mapped: PickupLine[] = []
    for (const line of lines) {
      const listing = offered.find((candidate) => candidate.productId === productOf.get(line.listingId))
      if (!listing) break
      if (line.listingVariantId) {
        const variant = listing.storeListingVariants.find((candidate) => candidate.variantId === variantOf.get(line.listingVariantId!))
        if (!variant || (variant.trackInventory && variant.stock < line.quantity)) break
        mapped.push({ ...line, listingId: listing.id, listingVariantId: variant.id })
      } else {
        if (listing.trackInventory && listing.stock < line.quantity) break
        mapped.push({ ...line, listingId: listing.id, listingVariantId: null })
      }
    }
    if (mapped.length === lines.length) options.push({ location, lines: mapped })
  }
  return options
}

// An order's copy of its location, or null when it has none
export function orderPickupLocation(order: {
  pickupName: string | null
  pickupAddress: string | null
  pickupHours: string | null
  pickupPhone: string | null
  pickupMapUrl: string | null
}): PickupLocationView | null {
  if (!order.pickupAddress) return null
  return { name: order.pickupName ?? "", address: order.pickupAddress, hours: order.pickupHours, phone: order.pickupPhone, mapUrl: order.pickupMapUrl }
}
