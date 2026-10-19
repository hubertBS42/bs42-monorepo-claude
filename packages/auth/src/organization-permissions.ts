import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements, adminAc, memberAc, ownerAc } from "better-auth/plugins/organization/access"

const statement = {
  ...defaultStatements,
  listing: ["create", "update", "delete"],
  // Orders made up only of the store's own items. refund gives money back and records returns, for owners and admins;
  // the platform can do the same on any order (the system order permission).
  order: ["read", "create", "update", "refund"],
  // Buying stock in from suppliers. receive adds a delivery to stock (whoever unpacks it); cancel also closes a partly
  // received order and deletes a draft.
  purchaseOrder: ["read", "create", "update", "receive", "cancel"],
  supplier: ["create", "update", "delete"],
} as const

export const organizationAccessController = createAccessControl(statement)

export const organizationRoles = {
  owner: organizationAccessController.newRole({
    ...ownerAc.statements,
    listing: ["create", "update", "delete"],
    order: ["read", "create", "update", "refund"],
    purchaseOrder: ["read", "create", "update", "receive", "cancel"],
    supplier: ["create", "update", "delete"],
  }),

  admin: organizationAccessController.newRole({
    ...adminAc.statements,
    listing: ["create", "update", "delete"],
    order: ["read", "create", "update", "refund"],
    purchaseOrder: ["read", "create", "update", "receive", "cancel"],
    supplier: ["create", "update", "delete"],
  }),
  member: organizationAccessController.newRole({
    ...memberAc.statements,
    listing: ["create", "update"],
    order: ["read", "create"],
    purchaseOrder: ["read", "receive"],
  }),
}

export type OrgRole = keyof typeof organizationRoles
export const ORG_ROLE_NAMES = Object.keys(organizationRoles) as [OrgRole, ...Array<OrgRole>]
