import "server-only"

import { loadInstallationAreas } from "@workspace/commerce/installation"
import type { InstallationAreaRow } from "@workspace/commerce/installation-areas"
import { prisma } from "@workspace/db"

// Where installers work, for the Installation card in Settings. Not secret: the storefront shows them to anyone.
export interface InstallationAreasView {
  // The settings row's updatedAt, or "" before the first save: the card sends it back
  version: string
  areas: InstallationAreaRow[]
}

export async function getInstallationAreas(): Promise<InstallationAreasView> {
  // One after the other, like the storefront's loaders
  const settings = await prisma.installationSettings.findUnique({ where: { id: "singleton" }, select: { updatedAt: true } })
  return { version: settings?.updatedAt.toISOString() ?? "", areas: await loadInstallationAreas(prisma) }
}
