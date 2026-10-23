import "server-only"

import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { prisma } from "@workspace/db"

// The caller's own sessions that haven't expired. Selects only what the sessions page shows: a session row also holds
// its token, which must never reach a client component.
export const getUserSessions = async (userId: string) => {
  return prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  })
}

export type UserSession = Awaited<ReturnType<typeof getUserSessions>>[number]

// The stores whose emails the user gets: where they're an owner or admin. None for platform staff, who are members of
// every store but get the platform's emails instead (Settings → Notifications).
export const getStoreNotificationSettings = async (userId: string, systemRole: string | null | undefined) => {
  if (hasSystemRole(systemRole, consoleAdminRoles)) return []
  const members = await prisma.member.findMany({
    where: { userId, role: { in: ["owner", "admin"] }, organization: { slug: { not: PLATFORM_ORGANIZATION_SLUG } } },
    select: { notifyOrders: true, notifyStock: true, notifyRefunds: true, organization: { select: { id: true, name: true } } },
    orderBy: { organization: { name: "asc" } },
  })
  return members.map(({ organization, ...preferences }) => ({ storeId: organization.id, storeName: organization.name, preferences }))
}

export type StoreNotificationSettings = Awaited<ReturnType<typeof getStoreNotificationSettings>>[number]
