"use server"

import { headers } from "next/headers"
import { APIError } from "better-auth/api"
import { consoleAuth } from "@workspace/auth/console"
import { formatError } from "@workspace/auth/format-error"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { isManagedFileUrl, removeFiles } from "@workspace/storage"
import z from "zod"
import { requireConsoleAccess } from "@/lib/auth-guard"
import { sessionIdSchema, storeNotificationSchema, updatePasswordSchema, updateProfileSchema } from "@/lib/schemas/account.schemas"

// Every export here is a public endpoint, so every input is validated

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

export async function updateProfileAction(input: z.input<typeof updateProfileSchema>): Promise<ActionResponse> {
  const { user } = await requireConsoleAccess()

  try {
    const parsed = updateProfileSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { name, image } = parsed.data

    // The client could send any URL, so only accept blobs in our own container
    if (image !== null && !isManagedFileUrl(image)) {
      return { success: false, error: "Invalid file URL", code: "INVALID_FILE" }
    }

    // Read from the database: the session's copy can be stale while the cookie cache lasts
    const previous = await prisma.user.findUnique({ where: { id: user.id }, select: { image: true } })

    await consoleAuth.api.updateUser({
      body: { name, image },
      headers: await headers(),
    })

    // Only the server knows the saved avatar for sure, so it removes the replaced one once the update has been saved
    if (previous?.image && previous.image !== image) await removeFiles([previous.image], "Avatar cleanup")

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Takes the session's id rather than its token, so tokens never reach the browser
export async function revokeSessionAction(sessionId: string): Promise<ActionResponse> {
  const { user } = await requireConsoleAccess()

  try {
    const parsed = sessionIdSchema.safeParse(sessionId)
    if (!parsed.success) return invalidInput(parsed.error)

    const target = await prisma.session.findFirst({
      where: { id: parsed.data, userId: user.id },
      select: { token: true },
    })
    if (!target) return { success: false, error: "Session not found", code: "NOT_FOUND" }

    await consoleAuth.api.revokeSession({
      body: { token: target.token },
      headers: await headers(),
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function revokeOtherSessionsAction(): Promise<ActionResponse> {
  await requireConsoleAccess()

  try {
    await consoleAuth.api.revokeOtherSessions({ headers: await headers() })
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Signs out every other session, in case the old password was stolen. revokeOtherSessions on changePassword would
// also replace the current session with a new one that has no active organization, leaving the console without a
// workspace, so the other sessions are revoked in a second call that keeps the current one.
export async function updatePasswordAction(input: z.input<typeof updatePasswordSchema>): Promise<ActionResponse> {
  await requireConsoleAccess()

  try {
    const parsed = updatePasswordSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { currentPassword, newPassword } = parsed.data
    const headersObj = await headers()

    await consoleAuth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: false },
      headers: headersObj,
    })

    try {
      await consoleAuth.api.revokeOtherSessions({ headers: headersObj })
    } catch (error) {
      console.error("Could not revoke other sessions after a password change:", error)
      return {
        success: false,
        error: "Your password was changed, but your other devices are still signed in. Sign them out from the Sessions page.",
        code: "SESSIONS_NOT_REVOKED",
      }
    }

    return { success: true }
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      return { success: false, error: "The current password is incorrect", code: "INVALID_PASSWORD" }
    }
    return { success: false, error: formatError(error) }
  }
}

// One switch on /account/notifications, saved as it's flipped. Only the user's own membership of that store changes.
export async function setStoreNotificationAction(input: z.input<typeof storeNotificationSchema>): Promise<ActionResponse> {
  const { user } = await requireConsoleAccess()

  try {
    const parsed = storeNotificationSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, preference, enabled } = parsed.data

    const { count } = await prisma.member.updateMany({ where: { userId: user.id, organizationId: storeId }, data: { [preference]: enabled } })
    if (count === 0) return { success: false, error: "You're no longer a member of this store.", code: "NOT_MEMBER" }
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
