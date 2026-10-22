import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements, adminAc, userAc } from "better-auth/plugins/admin/access"

const statement = {
  ...defaultStatements,
  organization: ["create", "update", "delete", "switch"],
  brand: ["create", "update", "delete"],
  category: ["create", "update", "delete"],
  product: ["create", "update", "delete"],
  // Platform orders (the platform is the seller). update covers status, shipping and tax overrides; refund gives money back.
  order: ["read", "create", "update", "refund"],
  // Storefront customers' trade accounts: update approves, rejects, suspends and sets the discount
  tradeAccount: ["read", "update"],
  appSettings: ["update"],
} as const

export const systemAccessController = createAccessControl(statement)

export const systemRoles = {
  user: systemAccessController.newRole({
    ...userAc.statements,
  }),
  // No set-role, set-password or impersonate: admins could otherwise make themselves superAdmin or act as one.
  // Roles on new users are set by the console's createUserAction after its own checks.
  admin: systemAccessController.newRole({
    user: ["create", "list", "get", "update", "set-email", "ban", "delete"],
    session: ["list", "revoke"],
    organization: ["create", "update"],
    brand: ["create", "update", "delete"],
    category: ["create", "update", "delete"],
    product: ["create", "update", "delete"],
    // Refunds give money back, so they're for superAdmins only
    order: ["read", "create", "update"],
    tradeAccount: ["read", "update"],
  }),
  superAdmin: systemAccessController.newRole({
    ...adminAc.statements,
    organization: ["create", "update", "delete", "switch"],
    brand: ["create", "update", "delete"],
    category: ["create", "update", "delete"],
    product: ["create", "update", "delete"],
    order: ["read", "create", "update", "refund"],
    tradeAccount: ["read", "update"],
    appSettings: ["update"],
  }),
}

export const consoleAdminRoles = ["admin", "superAdmin"] as const

export type SystemRole = keyof typeof systemRoles

export function hasSystemRole(role: string | null | undefined, allowedRoles: readonly string[]) {
  if (!role) {
    return false
  }

  const assignedRoles = role.split(",").map((assignedRole) => assignedRole.trim())
  return allowedRoles.some((allowedRole) => assignedRoles.includes(allowedRole))
}

export function hasSystemPermission(role: string | null | undefined, permissions: Parameters<(typeof systemRoles)["admin"]["authorize"]>[0]) {
  if (!role) {
    return false
  }

  return role
    .split(",")
    .map((assignedRole) => assignedRole.trim())
    .some((assignedRole) => Object.hasOwn(systemRoles, assignedRole) && systemRoles[assignedRole as keyof typeof systemRoles].authorize(permissions).success)
}

export const SYSTEM_ROLE_NAMES = Object.keys(systemRoles) as [SystemRole, ...Array<SystemRole>]

// Only superAdmins can manage (update, ban, delete) users who hold the superAdmin role
export function canManageUserWithRole(actorRole: string | null | undefined, targetRole: string | null | undefined) {
  return hasSystemRole(actorRole, ["superAdmin"]) || !hasSystemRole(targetRole, ["superAdmin"])
}

// The role system admins get in every store: superAdmins are owners, admins are admins
export function storeRoleForSystemAdmin(role: string | null | undefined): "owner" | "admin" {
  return hasSystemRole(role, ["superAdmin"]) ? "owner" : "admin"
}
