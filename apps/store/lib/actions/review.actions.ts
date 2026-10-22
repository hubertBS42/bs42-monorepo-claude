"use server"

import { after } from "next/server"
import { notifyLowRating } from "@workspace/commerce/notifications"
import { deleteReview, ReviewError, saveReview } from "@workspace/commerce/reviews"
import type { ActionResponse, DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { z } from "zod"

import { reviewSchema, type ReviewValues } from "@/lib/schemas/review.schemas"
import { getStoreSession } from "@/lib/session"

const SIGNED_OUT = { success: false as const, error: "Your session has ended. Sign in again to save your review.", code: "UNAUTHORIZED" }
const NOT_FOUND = { success: false as const, error: "We can't find that product.", code: "NOT_FOUND" }

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

// Writes the signed-in customer's review of a product, or changes theirs. Only buyers can (NOT_ELIGIBLE).
export async function saveReviewAction(productId: string, input: ReviewValues): Promise<DataResponse<{ published: boolean }>> {
  const session = await getStoreSession()
  if (!session) return SIGNED_OUT
  if (!z.uuid().safeParse(productId).success) return NOT_FOUND

  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check your review.", code: "INVALID_INPUT" }

  try {
    const review = await prisma.$transaction((tx) => saveReview(tx, session.user, productId, parsed.data), TRANSACTION_OPTIONS)
    // Only once it's saved: after() also runs when an action fails
    if (review.lowered) after(() => notifyLowRating(review.id))
    return { success: true, data: { published: review.published } }
  } catch (error) {
    if (error instanceof ReviewError) return { success: false, error: error.message, code: error.code }
    console.error("Could not save a review:", error)
    return { success: false, error: "We couldn't save your review just now. Please try again." }
  }
}

export async function deleteReviewAction(productId: string): Promise<ActionResponse> {
  const session = await getStoreSession()
  if (!session) return SIGNED_OUT
  if (!z.uuid().safeParse(productId).success) return NOT_FOUND

  try {
    await prisma.$transaction((tx) => deleteReview(tx, session.user.id, productId), TRANSACTION_OPTIONS)
    return { success: true }
  } catch (error) {
    console.error("Could not delete a review:", error)
    return { success: false, error: "We couldn't delete your review just now. Please try again." }
  }
}
