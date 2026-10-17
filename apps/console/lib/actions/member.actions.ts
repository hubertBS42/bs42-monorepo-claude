"use server"

import { consoleAuth } from "@workspace/auth/console"
import { APIError } from "better-auth/api"
import { headers } from "next/headers"
import { OrgRole } from "@workspace/auth/organization-permissions"
import { formatError } from "@workspace/auth/format-error"
import { prisma } from "@workspace/db"
import { ActionResponse } from "@workspace/contracts"
import { getOrganizationRoleWithPermission, requireConsoleAccess } from "@/lib/auth-guard"
import { addStoreMemberSchema, leaveStoreSchema, removeStoreMemberSchema, updateStoreMemberRoleSchema } from "@/lib/schemas/member.schemas"
import z from "zod"

// Every export here is a public endpoint, so the session always comes from the request, never from the caller,
// and every input is validated. Each one calls requireConsoleAccess before its try block: it redirects storefront
// customers (who share the auth cookie) by throwing, which the catch would swallow.

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

export async function addStoreMemberAction(input: { userId: string; storeId: string; role: OrgRole }): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = addStoreMemberSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { userId, storeId, role } = parsed.data

    const headersObj = await headers()

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

// Better Auth checks the caller's permissions on removeMember, updateMemberRole and leaveOrganization.
// Remove and update look the member up in the store first, so a stale row gets a code the page can act on.

const memberNotFoundResponse: ActionResponse = {
  success: false,
  error: "This member is no longer in the store. Refresh the page to see its current members.",
  code: "NOT_FOUND",
}

async function findStoreMember(memberId: string, storeId: string) {
  return prisma.member.findFirst({ where: { id: memberId, organizationId: storeId }, select: { role: true } })
}

export async function removeStoreMemberAction(input: { memberId: string; storeId: string }): Promise<ActionResponse> {
  await requireConsoleAccess()

  try {
    const parsed = removeStoreMemberSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { memberId, storeId } = parsed.data

    const headersObj = await headers()

    if (!(await findStoreMember(memberId, storeId))) return memberNotFoundResponse

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

export async function updateStoreMemberRoleAction(input: { memberId: string; storeId: string; role: OrgRole; currentRole: string }): Promise<ActionResponse> {
  await requireConsoleAccess()

  try {
    const parsed = updateStoreMemberRoleSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { memberId, storeId, role, currentRole } = parsed.data

    const headersObj = await headers()

    const member = await findStoreMember(memberId, storeId)
    if (!member) return memberNotFoundResponse
    if (member.role !== currentRole) {
      return { success: false, error: "This member's role was changed by someone else. Refresh the page to see it.", code: "ROLE_CHANGED" }
    }

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
  await requireConsoleAccess()

  try {
    const parsed = leaveStoreSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId } = parsed.data

    const headersObj = await headers()

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
    if (error instanceof APIError && error.body?.code === "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER") {
      return { success: false, error: "You're the store's only owner. Make another member an owner before you leave.", code: "LAST_OWNER" }
    }
    return { success: false, error: formatError(error) }
  }
}
