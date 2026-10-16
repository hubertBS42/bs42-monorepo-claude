import "server-only"

import { prisma } from "@workspace/db"

/**
 * The settings row's version: its updatedAt as an ISO string, or "" before the first save. The settings form sends it
 * back, and saveAppSettings only writes if it still matches, so a form opened before someone else's save can't undo it.
 */
export async function getAppSettingsVersion(): Promise<string> {
  const row = await prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { updatedAt: true } })
  return row?.updatedAt.toISOString() ?? ""
}
