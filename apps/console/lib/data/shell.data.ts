import "server-only"

import { consoleAuth } from "@workspace/auth/console"
import { prisma } from "@workspace/db"
import { headers } from "next/headers"
import type { ShellData } from "@/components/shell-data"

// What the shell's sidebar shows (the user, the active workspace and the workspaces to switch to), loaded with the
// page so it renders complete instead of as skeletons while the browser fetches the session. Only the fields shown:
// no session row, which holds its token. Null when signed out: the page's own guard sends the visitor away.
export async function getShellData(): Promise<ShellData> {
  const session = await consoleAuth.api.getSession({ headers: await headers() })
  if (!session) return null

  const organizations = await prisma.organization.findMany({
    where: { members: { some: { userId: session.user.id } } },
    select: { id: true, name: true, slug: true, logo: true },
    orderBy: { name: "asc" },
  })

  const { id, name, email, image, role } = session.user
  return { user: { id, name, email, image: image ?? null, role: role ?? null }, activeOrganizationId: session.session.activeOrganizationId ?? null, organizations }
}
