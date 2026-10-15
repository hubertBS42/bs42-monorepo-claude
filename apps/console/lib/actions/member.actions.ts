"use server"

import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { OrgRole } from "@workspace/auth/organization-permissions"
import { formatError } from "@workspace/auth/format-error"
import { prisma } from "@workspace/db"
import { ActionResponse } from "@workspace/contracts"
import { getOrganizationRoleWithPermission } from "@/lib/auth-guard"
import { addStoreMemberSchema, leaveStoreSchema, removeStoreMemberSchema, updateStoreMemberRoleSchema } from "@/lib/schemas/member.schemas"
import z from "zod"

// Every export here is a public endpoint, so the session always comes from the request, never from the caller,
// and every input is validated.

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

export async function addStoreMemberAction(input: { userId: string; storeId: string; role: OrgRole }): Promise<ActionResponse> {
  try {
    const parsed = addStoreMemberSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { userId, storeId, role } = parsed.data

    const headersObj = await headers()
    const session = await consoleAuth.api.getSession({ headers: headersObj })
    if (!session) return { success: false, error: "Unauthorized" }

    // Better Auth's addMember is server-only and doesn't check permissions, so check them here
    const callerRole = await getOrganizationRoleWithPermission(session.user.id, storeId, { member: ["create"] })
    if (!callerRole) return { success: false, error: "Forbidden" }
    if (role === "owner" && callerRole !== "owner") return { success: false, error: "Only store owners can add owners" }

    // Fetch store and user in parallel
    const [store, user] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: storeId },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
    ])

    if (!store) return { success: false, error: "Store not found" }
    if (!user) return { success: false, error: "User not found" }

    await consoleAuth.api.addMember({
      body: {
        userId,
        role,
        organizationId: storeId,
      },
      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Better Auth checks the caller's permissions on removeMember, updateMemberRole and leaveOrganization

export async function removeStoreMemberAction(input: { memberId: string; storeId: string }): Promise<ActionResponse> {
  try {
    const parsed = removeStoreMemberSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { memberId, storeId } = parsed.data

    const headersObj = await headers()
    const session = await consoleAuth.api.getSession({ headers: headersObj })
    if (!session) return { success: false, error: "Unauthorized" }

    await consoleAuth.api.removeMember({
      body: {
        memberIdOrEmail: memberId,
        organizationId: storeId,
      },
      headers: headersObj,
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function updateStoreMemberRoleAction(input: { memberId: string; storeId: string; role: OrgRole }): Promise<ActionResponse> {
  try {
    const parsed = updateStoreMemberRoleSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { memberId, storeId, role } = parsed.data

    const headersObj = await headers()
    const session = await consoleAuth.api.getSession({ headers: headersObj })
    if (!session) return { success: false, error: "Unauthorized" }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true },
    })

    if (!member) return { success: false, error: "Member not found" }

    await consoleAuth.api.updateMemberRole({
      body: {
        memberId,
        role,
        organizationId: storeId,
      },

      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function leaveStoreAction(input: { storeId: string }): Promise<ActionResponse> {
  try {
    const parsed = leaveStoreSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId } = parsed.data

    const headersObj = await headers()
    const session = await consoleAuth.api.getSession({ headers: headersObj })
    if (!session) return { success: false, error: "Unauthorized" }

    const store = await prisma.organization.findUnique({
      where: { id: storeId },
      select: { id: true },
    })

    if (!store) return { success: false, error: "Store not found" }

    await consoleAuth.api.leaveOrganization({
      body: {
        organizationId: storeId,
      },
      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
