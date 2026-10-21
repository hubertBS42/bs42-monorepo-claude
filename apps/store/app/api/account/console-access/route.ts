import { authURLs } from "@workspace/auth/constants"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { prisma } from "@workspace/db"

import { getStoreSession } from "@/lib/session"

// Whether the signed-in customer can use the console, for the account menu's "Open console" (staff only). The same
// rule as the console's hasConsoleAccess: system admins, and members of a store (the platform organization doesn't
// count). The store's session has neither the role nor the memberships, so this reads the database.
export async function GET() {
  const session = await getStoreSession()
  let consoleUrl: string | null = null

  if (session) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    const isStaff =
      hasSystemRole(user?.role, consoleAdminRoles) ||
      !!(await prisma.member.findFirst({ where: { userId: session.user.id, organization: { slug: { not: PLATFORM_ORGANIZATION_SLUG } } }, select: { id: true } }))
    if (isStaff) consoleUrl = authURLs.console
  }

  return Response.json({ consoleUrl }, { headers: { "Cache-Control": "private, no-store" } })
}
