import "server-only"

import { consoleAuth } from "@workspace/auth/console"
import { consoleAdminRoles, hasSystemPermission, hasSystemRole } from "@workspace/auth/system-permissions"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export type SystemPermission = Parameters<(typeof import("@workspace/auth/system-permissions").systemRoles)["admin"]["authorize"]>[0]

export type OrganizationPermission = Parameters<(typeof import("@workspace/auth/organization-permissions").organizationRoles)["owner"]["authorize"]>[0]

function isOrganizationRole(role: string): role is keyof typeof organizationRoles {
  return Object.hasOwn(organizationRoles, role)
}

export async function getConsoleSession() {
  const session = await consoleAuth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  return session
}

// System admins always have access. Other users need a membership in at
// least one store (the platform organization doesn't count), which keeps
// storefront customers out of the console.
export async function hasConsoleAccess(user: { id: string; role?: string | null }) {
  if (hasSystemRole(user.role, consoleAdminRoles)) return true

  const membership = await prisma.member.findFirst({
    where: {
      userId: user.id,
      organization: { slug: { not: PLATFORM_ORGANIZATION_SLUG } },
    },
    select: { id: true },
  })
  return !!membership
}

export async function requireConsoleAccess() {
  const session = await getConsoleSession()

  if (!(await hasConsoleAccess(session.user))) {
    redirect("/no-stores")
  }

  return session
}

export async function requireConsoleAdmin() {
  const session = await getConsoleSession()

  if (!hasSystemRole(session.user.role, consoleAdminRoles)) {
    redirect("/forbidden")
  }

  return session
}

export async function requireSystemPermission(permissions: SystemPermission) {
  const session = await getConsoleSession()

  if (!hasSystemPermission(session.user.role, permissions)) {
    redirect("/forbidden")
  }

  return session
}

export async function requireOrganizationPermission(organizationId: string, permissions: OrganizationPermission) {
  const session = await getConsoleSession()

  const membership = await prisma.member.findFirst({
    where: {
      organizationId,
      userId: session.user.id,
    },
    select: {
      role: true,
    },
  })

  if (!membership || !isOrganizationRole(membership.role) || !organizationRoles[membership.role].authorize(permissions).success) {
    redirect("/forbidden")
  }

  return { session, organizationId, role: membership.role }
}
