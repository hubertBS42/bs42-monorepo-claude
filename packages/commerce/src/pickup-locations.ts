import type { prisma } from "@workspace/db"

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

// The location a pickup of these stores' items is collected from: only items all from one store, which has one
export async function pickupLocationForStores(client: Client, storeIds: (string | null)[]): Promise<PickupLocationView | null> {
  const ids = [...new Set(storeIds.filter((id): id is string => !!id))]
  if (ids.length !== 1) return null
  return client.pickupLocation.findUnique({ where: { organizationId: ids[0] }, select: pickupLocationSelect })
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
