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

// The branches that can supply the store's pickup location: every other store in its branch group, with its lead time
// when it supplies the location (null when it doesn't). Null when the store has no location or no other branches.
export async function getPickupSuppliers(storeId: string) {
  const [location, membership] = await Promise.all([
    prisma.pickupLocation.findUnique({ where: { organizationId: storeId }, select: { id: true, suppliers: { select: { organizationId: true, leadDays: true } } } }),
    prisma.branchMembership.findUnique({
      where: { organizationId: storeId },
      select: { group: { select: { name: true, stores: { select: { organization: { select: { id: true, name: true } } } } } } },
    }),
  ])
  if (!location || !membership) return null
  const branches = membership.group.stores.map((row) => row.organization).filter((store) => store.id !== storeId)
  if (!branches.length) return null
  const leadDays = new Map(location.suppliers.map((supplier) => [supplier.organizationId, supplier.leadDays]))
  return { groupName: membership.group.name, branches: branches.map((store) => ({ id: store.id, name: store.name, leadDays: leadDays.get(store.id) ?? null })) }
}
