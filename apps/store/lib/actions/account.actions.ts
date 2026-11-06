"use server"

import { headers } from "next/headers"
import { sendPasswordChangedEmail, storeAuth } from "@workspace/auth/store"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { z } from "zod"

import { AddressError, makeDefaultAddress, removeAddress, saveAddress } from "@/lib/addresses"
import { changePasswordSchema, profileSchema, type ChangePasswordValues, type ProfileValues } from "@/lib/schemas/account.schemas"
import { addressSchema, type AddressValues } from "@/lib/schemas/address.schemas"
import { getStoreSession } from "@/lib/session"

const SIGNED_OUT = { success: false as const, error: "Your session has ended. Sign in again to make changes.", code: "UNAUTHORIZED" }

const emailPreferenceSchema = z.object({
  preference: z.enum(["getOrderEmails", "getMarketingEmails"]),
  enabled: z.boolean(),
})

// One switch on the email preferences page, saved as it's flipped. Straight to the row: nothing reads these from the
// session, so its cache can't hold a stale copy that matters.
export async function setEmailPreferenceAction(input: z.input<typeof emailPreferenceSchema>): Promise<ActionResponse> {
  const session = await getStoreSession()
  if (!session) return SIGNED_OUT

  const parsed = emailPreferenceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "That preference can't be changed here.", code: "INVALID_INPUT" }

  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { [parsed.data.preference]: parsed.data.enabled } })
    return { success: true }
  } catch (error) {
    console.error("Could not save an email preference:", error)
    return { success: false, error: "We couldn't save that just now. Please try again." }
  }
}

// Account details: the name and phone. Through Better Auth, so the session's cached copy (the header's name) is
// refreshed too. The email isn't taken: it can't change.
export async function updateProfileAction(input: ProfileValues): Promise<ActionResponse> {
  const session = await getStoreSession()
  if (!session) return SIGNED_OUT

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check your details.", code: "INVALID_INPUT" }

  try {
    await storeAuth.api.updateUser({ body: { name: parsed.data.name, phone: parsed.data.phone || null }, headers: await headers() })
    return { success: true }
  } catch (error) {
    console.error("Could not save a customer's details:", error)
    return { success: false, error: "We couldn't save that just now. Please try again." }
  }
}

// A new password, given the current one. Then every other device is signed out, and the customer is emailed. Not with
// changePassword's revokeOtherSessions: it replaces this session too, and the session is shared with the console.
export async function changePasswordAction(input: ChangePasswordValues): Promise<ActionResponse> {
  const session = await getStoreSession()
  if (!session) return SIGNED_OUT

  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the passwords.", code: "INVALID_INPUT" }

  const requestHeaders = await headers()
  try {
    await storeAuth.api.changePassword({ body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.password, revokeOtherSessions: false }, headers: requestHeaders })
  } catch (error) {
    const code = (error as { body?: { code?: string } } | null)?.body?.code
    if (code === "INVALID_PASSWORD") return { success: false, error: "Your current password is incorrect.", code: "INVALID_PASSWORD" }
    // An account made with Google has no password to change
    if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") return { success: false, error: "This account signs in with Google, so it has no password.", code: "NO_PASSWORD" }
    console.error("Could not change a customer's password:", error)
    return { success: false, error: "We couldn't change your password just now. Please try again." }
  }

  sendPasswordChangedEmail(session.user)
  try {
    await storeAuth.api.revokeOtherSessions({ headers: requestHeaders })
  } catch (error) {
    console.error("Could not sign out other devices after a password change:", error)
    return { success: false, error: "Your password was changed, but your other devices may still be signed in.", code: "SESSIONS_NOT_REVOKED" }
  }
  return { success: true }
}

// Saved addresses. Each finds the address among the signed-in customer's own, so another account's id does nothing.

function addressFailure(error: unknown): ActionResponse {
  if (error instanceof AddressError) return { success: false, error: error.message, code: error.code }
  console.error("Could not change a saved address:", error)
  return { success: false, error: "We couldn't save that just now. Please try again." }
}

export async function saveAddressAction(input: AddressValues, id?: string): Promise<ActionResponse> {
  const session = await getStoreSession()
  if (!session) return SIGNED_OUT

  const parsed = addressSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the address.", code: "INVALID_INPUT" }
  if (id !== undefined && !z.uuid().safeParse(id).success) return { success: false, error: "We can't find that address.", code: "NOT_FOUND" }

  try {
    await saveAddress(session.user.id, parsed.data, id)
    return { success: true }
  } catch (error) {
    return addressFailure(error)
  }
}

export async function makeDefaultAddressAction(id: string): Promise<ActionResponse> {
  const session = await getStoreSession()
  if (!session) return SIGNED_OUT
  if (!z.uuid().safeParse(id).success) return { success: false, error: "We can't find that address.", code: "NOT_FOUND" }

  try {
    await makeDefaultAddress(session.user.id, id)
    return { success: true }
  } catch (error) {
    return addressFailure(error)
  }
}

export async function removeAddressAction(id: string): Promise<ActionResponse> {
  const session = await getStoreSession()
  if (!session) return SIGNED_OUT
  if (!z.uuid().safeParse(id).success) return { success: false, error: "We can't find that address.", code: "NOT_FOUND" }

  try {
    await removeAddress(session.user.id, id)
    return { success: true }
  } catch (error) {
    return addressFailure(error)
  }
}
