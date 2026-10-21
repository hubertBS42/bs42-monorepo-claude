import { z } from "zod"

// The Legal card in Settings: the storefront's Terms and Privacy pages. Rich text as the editor saves it; null (an
// empty editor) means no page.

const legalTextSchema = z.string().max(200_000, "This text is too long.").nullable()

export const legalPagesFormSchema = z.object({
  termsOfService: legalTextSchema,
  privacyPolicy: legalTextSchema,
})

export const saveLegalPagesSchema = z.object({
  // The row's updatedAt the page showed, or "" before the first save
  version: z.string(),
  pages: legalPagesFormSchema,
})
