import { z } from "zod"

// The Legal card in Settings: the storefront's Terms and Privacy pages. Rich text as the editor saves it; null (an
// empty editor) means no page. Each can be saved as a draft and published when it's ready.

const legalTextSchema = z.string().max(200_000, "This text is too long.").nullable()

export const legalPagesFormSchema = z
  .object({
    termsOfService: legalTextSchema,
    termsPublished: z.boolean(),
    privacyPolicy: legalTextSchema,
    privacyPublished: z.boolean(),
  })
  // A published page needs its text (a CHECK in the migration too)
  .superRefine((pages, ctx) => {
    if (pages.termsPublished && !pages.termsOfService) ctx.addIssue({ code: "custom", path: ["termsPublished"], message: "Write the Terms before publishing them." })
    if (pages.privacyPublished && !pages.privacyPolicy) ctx.addIssue({ code: "custom", path: ["privacyPublished"], message: "Write the Privacy Policy before publishing it." })
  })

export const saveLegalPagesSchema = z.object({
  // The row's updatedAt the page showed, or "" before the first save
  version: z.string(),
  pages: legalPagesFormSchema,
})
