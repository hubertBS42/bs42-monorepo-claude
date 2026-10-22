import { z } from "zod"

export const REVIEW_TITLE_MAX = 100
export const REVIEW_BODY_MIN = 20
export const REVIEW_BODY_MAX = 2000

export const reviewSchema = z.object({
  // 0 is the form's "not chosen yet"
  rating: z.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().min(3, "Give your review a title").max(REVIEW_TITLE_MAX, `Keep the title under ${REVIEW_TITLE_MAX} characters`),
  body: z.string().trim().min(REVIEW_BODY_MIN, `Tell us a little more (at least ${REVIEW_BODY_MIN} characters)`).max(REVIEW_BODY_MAX, `Keep your review under ${REVIEW_BODY_MAX} characters`),
})

export type ReviewValues = z.input<typeof reviewSchema>
