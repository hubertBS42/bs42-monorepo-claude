import "server-only"

import { prisma } from "@workspace/db"
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

// The user's newest notifications for the header's bell. A link into the workspace the session already has loses its
// ?workspace=, so it opens as an ordinary navigation.
export async function getBellNotifications(userId: string, activeOrganizationId: string | null | undefined) {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: BELL_SIZE,
      select: { id: true, kind: true, title: true, body: true, href: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])

  const items: BellNotification[] = rows.map((row) => {
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
  })
  return { items, unreadCount }
}
