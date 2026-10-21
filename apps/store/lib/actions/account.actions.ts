"use server"

import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { z } from "zod"

import { getStoreSession } from "@/lib/session"

const emailPreferenceSchema = z.object({
  preference: z.enum(["getOrderEmails", "getMarketingEmails"]),
  enabled: z.boolean(),
})

// One switch on the email preferences page, saved as it's flipped. Straight to the row: nothing reads these from the
// session, so its cache can't hold a stale copy that matters.
export async function setEmailPreferenceAction(input: z.input<typeof emailPreferenceSchema>): Promise<ActionResponse> {
  const session = await getStoreSession()
  if (!session) return { success: false, error: "Your session has ended. Sign in again to change your preferences.", code: "UNAUTHORIZED" }

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
