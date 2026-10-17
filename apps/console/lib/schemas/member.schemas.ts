import { ORG_ROLE_NAMES } from "@workspace/auth/organization-permissions"
import z from "zod"

export const addStoreMemberSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  storeId: z.uuid("Invalid store ID"),
  role: z.enum(ORG_ROLE_NAMES),
})

export const removeStoreMemberSchema = z.object({
  memberId: z.uuid("Invalid member ID"),
  storeId: z.uuid("Invalid store ID"),
})

export const updateStoreMemberRoleSchema = removeStoreMemberSchema.extend({
  role: z.enum(ORG_ROLE_NAMES),
  // The role the page showed, so a change made meanwhile (another tab, another owner) isn't overwritten
  currentRole: z.string(),
})

export const leaveStoreSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
})
