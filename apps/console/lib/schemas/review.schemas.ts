import { z } from "zod"
import { ReviewStatus } from "@workspace/db/enums"

// Hiding a review: the reason is shown to its author on their account's Reviews page
export const hideReviewSchema = z.object({
  reason: z.string().trim().min(3, "Say why it's hidden: its author sees this.").max(500, "Keep the reason under 500 characters."),
})

export const reviewStatusChangeSchema = z.object({
  reviewId: z.uuid(),
  // The status the page showed: a change someone else made first is refused (STATUS_CHANGED)
  currentStatus: z.enum(ReviewStatus),
  reason: z.string().trim().max(500).nullable(),
})

export type HideReviewInput = z.input<typeof hideReviewSchema>
export type HideReviewValues = z.output<typeof hideReviewSchema>
