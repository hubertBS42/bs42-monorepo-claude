"use server"

import { APIError } from "better-auth/api"
import { headers } from "next/headers"
import { OrgRole } from "@workspace/auth/organization-permissions"
import { INVITATION_EXPIRATION_SECONDS, PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { formatError } from "@workspace/auth/format-error"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { prisma } from "@workspace/db"
import { consoleAuth } from "@workspace/auth/console"
import { consoleBootstrapAuth } from "@workspace/auth/console-bootstrap"
import { invitedSignUpFormSchema, inviteMemberSchema } from "@/lib/schemas/invitation.schemas"
import { requireConsoleAccess } from "@/lib/auth-guard"
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

// Better Auth cancels an invitation whatever its status, and a resend of one that isn't pending
// creates a new invitation, so both check first: the row may be stale (another tab, another admin)
const notPendingResponse: ActionResponse = {
  success: false,
  error: "This invitation has already been accepted, rejected or cancelled. Refresh the page to see its current state.",
  code: "NOT_PENDING",
}

const RESEND_COOLDOWN_MS = 60 * 1000

// inviteMemberAction, cancelInvitationAction and resendInvitationAction are for store staff, so they call
// requireConsoleAccess before their try block (its redirect throws, which the catch would swallow).
// Accepting, rejecting and signing up are for invitees, who may have no console access yet.

export async function inviteMemberAction(input: { storeId: string; email: string; role: OrgRole }): Promise<ActionResponse> {
  await requireConsoleAccess()

  try {
    const { session, headersObj } = await getSessionContext()
    if (!session) return { success: false, error: "Unauthorized" }

    const parsed = inviteMemberSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid email or role" }
    const { storeId, email, role } = parsed.data

    // Better Auth's createInvitation checks that the user is a member allowed to invite
    const store = await prisma.organization.findUnique({
      where: { id: storeId },
      select: { slug: true },
    })
    if (!store) return { success: false, error: "Store not found" }
    if (store.slug === PLATFORM_ORGANIZATION_SLUG)
      return {
        success: false,
        error: "Members cannot be invited to the platform organization",
      }

    // System admins are added to every store automatically (and kept there), so there's nothing to invite them to
    const invitee = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { role: true },
    })
    if (hasSystemRole(invitee?.role, consoleAdminRoles)) {
      return { success: false, error: "This person is platform staff, who are already members of every store.", code: "PLATFORM_STAFF" }
    }

    await consoleAuth.api.createInvitation({
      body: { email, role, organizationId: storeId },
      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION") {
      return { success: false, error: "This email already has a pending invitation. Resend it from the list instead.", code: "ALREADY_INVITED" }
    }
    if (error instanceof APIError && error.body?.code === "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION") {
      return { success: false, error: "This person is already a member of the store.", code: "ALREADY_MEMBER" }
    }
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
  await requireConsoleAccess()

  try {
    // Invitation.id is a uuid column, so anything else would make Prisma throw instead of finding nothing
    if (!z.uuid().safeParse(invitationId).success) return { success: false, error: "Invitation not found" }

    const { session, headersObj } = await getSessionContext()
    if (!session) return { success: false, error: "Unauthorized" }

    const invitation = await getManageableInvitation(invitationId, session.user.id)
    if (!invitation) return { success: false, error: "Invitation not found" }
    if (invitation.status !== "pending") return notPendingResponse

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
  await requireConsoleAccess()

  try {
    // Invitation.id is a uuid column, so anything else would make Prisma throw instead of finding nothing
    if (!z.uuid().safeParse(invitationId).success) return { success: false, error: "Invitation not found" }

    const { session, headersObj } = await getSessionContext()
    if (!session) return { success: false, error: "Unauthorized" }

    const invitation = await getManageableInvitation(invitationId, session.user.id)
    if (!invitation) return { success: false, error: "Invitation not found" }
    if (invitation.status !== "pending") return notPendingResponse

    // Every send sets expiresAt to now plus the expiry, so it dates the last email
    const lastSentAt = invitation.expiresAt.getTime() - INVITATION_EXPIRATION_SECONDS * 1000
    if (Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
      return { success: false, error: "This invitation was sent less than a minute ago. Try again shortly.", code: "RECENTLY_SENT" }
    }

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
