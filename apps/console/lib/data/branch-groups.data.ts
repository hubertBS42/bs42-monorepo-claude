import "server-only"

import { prisma } from "@workspace/db"

// For Edit Store's Branch group card: the store's group, and every group with its stores
export async function getBranchGroupsForStore(storeId: string) {
  const groups = await prisma.branchGroup.findMany({ orderBy: { name: "asc" }, select: { name: true, stores: { select: { organizationId: true, organization: { select: { name: true } } } } } })
  return {
    current: groups.find((group) => group.stores.some((store) => store.organizationId === storeId))?.name ?? null,
    groups: groups.map((group) => ({ name: group.name, stores: group.stores.map((store) => store.organization.name) })),
  }
}
