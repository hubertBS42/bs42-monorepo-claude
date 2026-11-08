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

// A location a customer can choose; readyInDays is how long items brought from other branches take (0: none are)
export type PickupOption = PickupLocationView & { id: string; readyInDays?: number }

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

// Where a basket can be collected, and how. A location can take each line from its own store, on sale and in stock
// (the same product and variant, at that store's listing, so its stock and prices), or else from the store the basket
// holds the line at, when that store supplies the location (PickupSupplier) and has the stock: that line stays as it
// is, and is brought over, so the option is ready in the longest of those lead times. Nothing installed: the
// installers go to an address.
export async function pickupOptions(client: Client, lines: PickupLine[]): Promise<{ location: PickupOption; lines: PickupLine[] }[]> {
  if (!lines.length || lines.some((line) => line.installation)) return []
  const locations = await client.pickupLocation.findMany({
    orderBy: { name: "asc" },
    select: { id: true, organizationId: true, ...pickupLocationSelect, suppliers: { select: { organizationId: true, leadDays: true } } },
  })
  if (!locations.length) return []

  // What each line is, where the basket holds it and how much is there. One query after another: a transaction has one
  // connection.
  const listings = await client.storeListing.findMany({
    where: { id: { in: lines.map((line) => line.listingId) } },
    select: { id: true, productId: true, organizationId: true, stock: true, trackInventory: true },
  })
  const variants = await client.storeListingVariant.findMany({
    where: { id: { in: lines.flatMap((line) => line.listingVariantId ?? []) } },
    select: { id: true, variantId: true, stock: true, trackInventory: true },
  })
  const visibleCategoryIds = await loadVisibleCategoryIds(client)
  const listingOf = new Map(listings.map((listing) => [listing.id, listing]))
  const variantOf = new Map(variants.map((variant) => [variant.id, variant]))
  const productIds = [...new Set(listings.map((listing) => listing.productId))]
  const enough = (row: { stock: number; trackInventory: boolean } | undefined, quantity: number) => !!row && (!row.trackInventory || row.stock >= quantity)

  const options: { location: PickupOption; lines: PickupLine[] }[] = []
  for (const { organizationId, suppliers, ...location } of locations) {
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
    const leadDays = new Map(suppliers.map((supplier) => [supplier.organizationId, supplier.leadDays]))
    const mapped: PickupLine[] = []
    let readyInDays = 0
    for (const line of lines) {
      const held = listingOf.get(line.listingId)
      const heldVariant = line.listingVariantId ? variantOf.get(line.listingVariantId) : undefined
      // The location's own store first: ready without waiting
      const own = offered.find((candidate) => candidate.productId === held?.productId)
      const ownVariant = heldVariant && own?.storeListingVariants.find((candidate) => candidate.variantId === heldVariant.variantId)
      if (own && (line.listingVariantId ? enough(ownVariant, line.quantity) : enough(own, line.quantity))) {
        mapped.push({ ...line, listingId: own.id, listingVariantId: ownVariant?.id ?? null })
        continue
      }
      // Else brought from the store the basket holds it at, when that store supplies the location
      const days = held && leadDays.get(held.organizationId)
      if (days && (line.listingVariantId ? enough(heldVariant, line.quantity) : enough(held, line.quantity))) {
        mapped.push(line)
        readyInDays = Math.max(readyInDays, days)
        continue
      }
      break
    }
    if (mapped.length === lines.length) options.push({ location: { ...location, readyInDays }, lines: mapped })
  }
  return options
}

// The location by id, for an order a customer chose it for
export function loadPickupLocation(client: Client, id: string): Promise<PickupOption | null> {
  return client.pickupLocation.findUnique({ where: { id }, select: { id: true, ...pickupLocationSelect } })
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
