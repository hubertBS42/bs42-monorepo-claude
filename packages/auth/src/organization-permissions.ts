import { createAccessControl } from "better-auth/plugins/access"
import {
  defaultStatements,
  adminAc,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access"

const statement = {
  ...defaultStatements,
  listing: ["create", "update", "delete"],
} as const

export const organizationAccessController = createAccessControl(statement)

export const organizationRoles = {
  owner: organizationAccessController.newRole({
    ...ownerAc.statements,
    listing: ["create", "update", "delete"],
  }),

  admin: organizationAccessController.newRole({
    ...adminAc.statements,
    listing: ["create", "update", "delete"],
  }),
  member: organizationAccessController.newRole({
    ...memberAc.statements,
    listing: ["create", "update"],
  }),
}

export type OrgRole = keyof typeof organizationRoles
export const ORG_ROLE_NAMES = Object.keys(organizationRoles) as [
  OrgRole,
  ...Array<OrgRole>,
]
