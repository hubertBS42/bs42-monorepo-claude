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

// Returns the user's role in the organization when it grants the permissions, otherwise null.
// For server actions, which should return an error instead of redirecting.
export async function getOrganizationRoleWithPermission(userId: string, organizationId: string, permissions: OrganizationPermission) {
  const membership = await prisma.member.findFirst({
    where: {
      organizationId,
      userId,
    },
    select: {
      role: true,
    },
  })

  if (!membership || !isOrganizationRole(membership.role) || !organizationRoles[membership.role].authorize(permissions).success) {
    return null
  }

  return membership.role
}

export async function requireOrganizationPermission(organizationId: string, permissions: OrganizationPermission) {
  const session = await getConsoleSession()

  const role = await getOrganizationRoleWithPermission(session.user.id, organizationId, permissions)
  if (!role) {
    redirect("/forbidden")
  }

  return { session, organizationId, role }
}

// The user's role in a store, or null when they aren't a member. The platform organization isn't a store.
export async function getStoreRole(userId: string, organizationId: string) {
  const membership = await prisma.member.findFirst({
    where: {
      userId,
      organizationId,
      organization: { slug: { not: PLATFORM_ORGANIZATION_SLUG } },
    },
    select: { role: true },
  })

  return membership && isOrganizationRole(membership.role) ? membership.role : null
}

// For server actions on a store: whether the user's role there grants the permissions. False for the platform
// organization, which isn't a store.
export async function hasStorePermission(userId: string, organizationId: string, permissions: OrganizationPermission) {
  const role = await getStoreRole(userId, organizationId)
  return !!role && organizationRoles[role].authorize(permissions).success
}

// For store workspace pages every member may see: the member role has no read permission for
// requireOrganizationPermission to check. Without an active store, or after being removed from it
// (the session keeps its id), the user goes to the dashboard.
export async function requireActiveStoreMember() {
  const session = await getConsoleSession()

  const storeId = session.session.activeOrganizationId
  const role = storeId ? await getStoreRole(session.user.id, storeId) : null
  if (!storeId || !role) {
    redirect("/")
  }

  return { session, storeId, role }
}
