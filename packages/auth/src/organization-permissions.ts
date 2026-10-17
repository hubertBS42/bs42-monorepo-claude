import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements, adminAc, memberAc, ownerAc } from "better-auth/plugins/organization/access"

const statement = {
  ...defaultStatements,
  listing: ["create", "update", "delete"],
  // Orders made up only of the store's own items. Refunds are the platform's (the system order permission).
  order: ["read", "create", "update"],
} as const

export const organizationAccessController = createAccessControl(statement)

export const organizationRoles = {
  owner: organizationAccessController.newRole({
    ...ownerAc.statements,
    listing: ["create", "update", "delete"],
    order: ["read", "create", "update"],
  }),

  admin: organizationAccessController.newRole({
    ...adminAc.statements,
    listing: ["create", "update", "delete"],
    order: ["read", "create", "update"],
  }),
  member: organizationAccessController.newRole({
    ...memberAc.statements,
    listing: ["create", "update"],
    order: ["read", "create"],
  }),
}

export type OrgRole = keyof typeof organizationRoles
export const ORG_ROLE_NAMES = Object.keys(organizationRoles) as [OrgRole, ...Array<OrgRole>]
