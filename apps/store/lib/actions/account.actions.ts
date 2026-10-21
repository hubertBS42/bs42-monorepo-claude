"use server"

import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { z } from "zod"

import { AddressError, makeDefaultAddress, removeAddress, saveAddress } from "@/lib/addresses"
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
