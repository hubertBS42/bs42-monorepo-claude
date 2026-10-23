import "server-only"

import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import type { NotificationKind } from "@workspace/db/enums"

// How many the bell lists: the newest. Older ones are still counted as unread until marked.
const BELL_SIZE = 20

export interface BellNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  href: string
  // The page is in another workspace, so opening it switches the session (a full page load, so the sidebar follows)
  switchesWorkspace: boolean
  read: boolean
  createdAt: string
}

const notificationSelect = { id: true, kind: true, title: true, body: true, href: true, readAt: true, createdAt: true } satisfies Prisma.NotificationSelect

// A link into the workspace the session already has loses its ?workspace=, so it opens as an ordinary navigation
function toBellNotification(row: Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>, activeOrganizationId: string | null | undefined): BellNotification {
  const url = new URL(row.href, "http://console")
  const workspace = url.searchParams.get("workspace")
  if (workspace && workspace === activeOrganizationId) url.searchParams.delete("workspace")
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: `${url.pathname}${url.search}`,
    switchesWorkspace: url.searchParams.has("workspace"),
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  }
}

// The user's newest notifications for the header's bell
export async function getBellNotifications(userId: string, activeOrganizationId: string | null | undefined) {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: BELL_SIZE, select: notificationSelect }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])
  return { items: rows.map((row) => toBellNotification(row, activeOrganizationId)), unreadCount }
}

export const NOTIFICATIONS_PAGE_SIZE = 25

// Every notification the user still has (NOTIFICATION_LIFETIME_DAYS), newest first, a page at a time, for /notifications
export async function getNotificationsPage(
  userId: string,
  activeOrganizationId: string | null | undefined,
  { page, unreadOnly, kind }: { page: number; unreadOnly: boolean; kind?: NotificationKind }
) {
  const where: Prisma.NotificationWhereInput = { userId, ...(unreadOnly && { readAt: null }), ...(kind && { kind }) }
  const [rows, total, unreadCount, readCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * NOTIFICATIONS_PAGE_SIZE, take: NOTIFICATIONS_PAGE_SIZE, select: notificationSelect }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.count({ where: { userId, readAt: { not: null } } }),
  ])
  return { items: rows.map((row) => toBellNotification(row, activeOrganizationId)), total, totalPages: Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE)), unreadCount, readCount }
}
