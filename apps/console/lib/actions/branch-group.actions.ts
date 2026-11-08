"use server"

import { revalidatePath } from "next/cache"
import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { requireSystemPermission } from "@/lib/auth-guard"

// Which branch group a store belongs to, on the platform's Edit Store page: platform admins only, since grouping
// stores decides whose prices follow whose. A group with no stores left is removed.

const setBranchGroupSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
  // Null: no group (an independent store)
  groupName: z.string().trim().min(1, "Enter the group's name").max(100).nullable(),
})

export async function setBranchGroupAction(input: z.input<typeof setBranchGroupSchema>): Promise<ActionResponse> {
  await requireSystemPermission({ organization: ["update"] })

  try {
    const parsed = setBranchGroupSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
    const { storeId, groupName } = parsed.data

    await prisma.$transaction(async (tx) => {
      if (groupName) {
        const group = await tx.branchGroup.upsert({ where: { name: groupName }, create: { name: groupName }, update: {}, select: { id: true } })
        await tx.branchMembership.upsert({ where: { organizationId: storeId }, create: { organizationId: storeId, groupId: group.id }, update: { groupId: group.id } })
      } else {
        await tx.branchMembership.deleteMany({ where: { organizationId: storeId } })
      }
      await tx.branchGroup.deleteMany({ where: { stores: { none: {} } } })
    })
    revalidatePath(`/stores/${storeId}/edit`)
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
