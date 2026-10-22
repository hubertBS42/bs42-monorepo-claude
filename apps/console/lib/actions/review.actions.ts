"use server"

import { formatError } from "@workspace/auth/format-error"
import { ReviewError, setReviewStatus } from "@workspace/commerce/reviews"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { ReviewStatus } from "@workspace/db/enums"
import type { z } from "zod"

import { requireSystemPermission } from "@/lib/auth-guard"
import { reviewStatusChangeSchema } from "@/lib/schemas/review.schemas"

// Every export here is a public endpoint, so every input is validated

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

async function changeStatus(input: z.input<typeof reviewStatusChangeSchema>, to: ReviewStatus, changedById: string): Promise<ActionResponse> {
  const parsed = reviewStatusChangeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
  if (to === ReviewStatus.HIDDEN && !parsed.data.reason) return { success: false, error: "Say why it's hidden: its author sees this.", code: "INVALID" }

  try {
    await prisma.$transaction((tx) => setReviewStatus(tx, parsed.data.reviewId, { from: parsed.data.currentStatus, to, reason: parsed.data.reason, changedById }), TRANSACTION_OPTIONS)
    return { success: true }
  } catch (error) {
    if (error instanceof ReviewError) return { success: false, error: error.message, code: error.code }
    return { success: false, error: formatError(error) }
  }
}

// Takes a review off the product's page (and out of its rating), with the reason its author sees
export async function hideReviewAction(input: z.input<typeof reviewStatusChangeSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  const session = await requireSystemPermission({ product: ["update"] })
  return changeStatus(input, ReviewStatus.HIDDEN, session.user.id)
}

export async function publishReviewAction(input: z.input<typeof reviewStatusChangeSchema>): Promise<ActionResponse> {
  const session = await requireSystemPermission({ product: ["update"] })
  return changeStatus({ ...input, reason: null }, ReviewStatus.PUBLISHED, session.user.id)
}
