import "server-only"

import { prisma } from "@workspace/db"
import { pickupLocationSelect } from "@workspace/commerce/pickup-locations"

// Each store's pickup location name, by store id, for the wizards' Delivery or pickup choice. Names only: the staff
// pages that use it are admins', and a store's location is shown to customers anyway.
export async function getPickupLocationNames(): Promise<Record<string, string>> {
  const rows = await prisma.pickupLocation.findMany({ select: { organizationId: true, name: true } })
  return Object.fromEntries(rows.map((row) => [row.organizationId, row.name]))
}

// One store's, for its Store Details page (any member may see it)
export async function getStorePickupLocation(storeId: string) {
  return prisma.pickupLocation.findUnique({ where: { organizationId: storeId }, select: { ...pickupLocationSelect, updatedAt: true } })
}
