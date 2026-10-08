"use server"

import { headers } from "next/headers"
import { OrgRole } from "@workspace/auth/organization-permissions"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { formatError } from "@workspace/auth/format-error"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { prisma } from "@workspace/db"
import { consoleAuth } from "@workspace/auth/console"
import { consoleBootstrapAuth } from "@workspace/auth/console-bootstrap"
import { invitedSignUpFormSchema, inviteSchema } from "@/lib/schemas/invitation.schemas"
import { ActionResponse } from "@workspace/contracts"
import z from "zod"

async function getSessionContext() {
  const headersObj = await headers()
  const session = await consoleAuth.api.getSession({ headers: headersObj })
  return { session, headersObj }
}

// Invitations are only visible to members of the invitation's store
async function getManageableInvitation(invitationId: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { organization: { select: { slug: true } } },
  })
  if (!invitation) return null

  const membership = await prisma.member.findFirst({
    where: { organizationId: invitation.organizationId, userId },
    select: { id: true },
  })
  return membership ? invitation : null
}

export async function inviteMemberAction({ email, role }: { email: string; role: OrgRole }): Promise<ActionResponse> {
  try {
    const { session, headersObj } = await getSessionContext()
    if (!session) return { success: false, error: "Unauthorized" }

    const parsed = inviteSchema.safeParse({ email, role })
    if (!parsed.success) return { success: false, error: "Invalid email or role" }

    const activeStoreId = session.session.activeOrganizationId
    if (!activeStoreId) return { success: false, error: "No active store" }

    const store = await prisma.organization.findUnique({
      where: { id: activeStoreId },
      select: { slug: true },
    })
    if (!store) return { success: false, error: "Store not found" }
    if (store.slug === PLATFORM_ORGANIZATION_SLUG)
      return {
        success: false,
        error: "Members cannot be invited to the platform organization",
      }

    // System admins must hold the admin store role in every store
    const invitee = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      select: { role: true },
    })
    if (hasSystemRole(invitee?.role, consoleAdminRoles) && parsed.data.role !== "admin")
      return {
        success: false,
        error: "System admins can only be invited with the admin store role",
      }

    await consoleAuth.api.createInvitation({
      body: { ...parsed.data, organizationId: activeStoreId },
      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function acceptInvitationAction({ invitationId }: { invitationId: string }): Promise<ActionResponse> {
  try {
    const { session, headersObj } = await getSessionContext()
    if (!session) return { success: false, error: "Unauthorized" }

    await consoleAuth.api.acceptInvitation({
      body: { invitationId },
      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function rejectInvitationAction({ invitationId }: { invitationId: string }): Promise<ActionResponse> {
  try {
    const { session, headersObj } = await getSessionContext()
    if (!session) return { success: false, error: "Unauthorized" }

    await consoleAuth.api.rejectInvitation({
      body: { invitationId },
      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function cancelInvitationAction(invitationId: string): Promise<ActionResponse> {
  try {
    const { session, headersObj } = await getSessionContext()
    if (!session) return { success: false, error: "Unauthorized" }

    const invitation = await getManageableInvitation(invitationId, session.user.id)
    if (!invitation) return { success: false, error: "Invitation not found" }

    await consoleAuth.api.cancelInvitation({
      body: { invitationId },
      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function resendInvitationAction(invitationId: string): Promise<ActionResponse> {
  try {
    const { session, headersObj } = await getSessionContext()
    if (!session) return { success: false, error: "Unauthorized" }

    const invitation = await getManageableInvitation(invitationId, session.user.id)
    if (!invitation) return { success: false, error: "Invitation not found" }

    // resend reuses the pending invitation, so a failure can't lose it
    await consoleAuth.api.createInvitation({
      body: {
        email: invitation.email,
        role: invitation.role as OrgRole,
        organizationId: invitation.organizationId,
        resend: true,
      },
      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Sign-up is disabled on the console, so accounts can only be created by
// someone holding a valid invitation for the email address.
export async function signUpInvitedUserAction({
  invitationId,
  name,
  password,
  confirmPassword,
}: {
  invitationId: string
  name: string
  password: string
  confirmPassword: string
}): Promise<ActionResponse> {
  try {
    const parsed = invitedSignUpFormSchema.safeParse({
      name,
      password,
      confirmPassword,
    })
    if (!parsed.success)
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid details",
      }

    const idCheck = z.uuid().safeParse(invitationId)
    if (!idCheck.success) return { success: false, error: "This invitation is no longer valid" }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      select: { email: true, status: true, expiresAt: true },
    })
    if (!invitation || invitation.status !== "pending" || (invitation.expiresAt && invitation.expiresAt < new Date())) return { success: false, error: "This invitation is no longer valid" }

    const existing = await prisma.user.findUnique({
      where: { email: invitation.email.toLowerCase() },
      select: { id: true },
    })
    if (existing)
      return {
        success: false,
        error: "An account already exists for this email. Please sign in.",
        code: "EMAIL_EXISTS",
      }

    const signUp = await consoleBootstrapAuth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: invitation.email.toLowerCase(),
        password: parsed.data.password,
      },
    })

    // Receiving the invitation email proves ownership of the address
    await prisma.user.update({
      where: { id: signUp.user.id },
      data: { emailVerified: true },
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
