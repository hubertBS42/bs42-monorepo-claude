"use server"
import { z } from "zod"
import { prisma } from "@workspace/db"
import { formatError } from "@workspace/auth/format-error"
import type { ActionResponse } from "@workspace/contracts"
import { sanitizeRichText } from "@workspace/utils/rich-text"
import { requireSystemPermission } from "@/lib/auth-guard"
import { saveLegalPagesSchema } from "@/lib/schemas/legal.schemas"

// Every export here is a public endpoint, so every input is validated

const CONFLICT: ActionResponse = { success: false, error: "Someone else changed the legal pages. Refresh the page to see them.", code: "CONFLICT" }

// A page's "Last updated": when customers last saw its text change. Now when it's published with new text or just
// published; kept while it's published unchanged, and while it's a draft (it isn't shown); none once the text is gone.
function publishedAt(page: { text: string | null; published: boolean }, saved: { text: string | null; published: boolean; at: Date | null }, now: Date) {
  if (!page.text) return null
  if (!page.published) return saved.at
  return saved.published && page.text === saved.text ? saved.at : now
}

// Saves the storefront's Terms and Privacy pages, each published or a draft. The storefront shows the published ones,
// and links to them, within a minute (its caches only expire).
export async function saveLegalPagesAction(input: z.input<typeof saveLegalPagesSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ appSettings: ["update"] })

  try {
    const parsed = saveLegalPagesSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
    const { version, pages } = parsed.data
    const termsOfService = sanitizeRichText(pages.termsOfService)
    const privacyPolicy = sanitizeRichText(pages.privacyPolicy)
    // Cleaning can leave nothing: then there's nothing to publish
    if ((pages.termsPublished && !termsOfService) || (pages.privacyPublished && !privacyPolicy)) return { success: false, error: "Write a page before publishing it.", code: "INVALID" }

    return await prisma.$transaction(async (tx) => {
      const saved = await tx.legalPages.findUnique({ where: { id: "singleton" } })
      // Only from the version the page showed: the row's updatedAt, or no row at all before the first save
      if ((saved?.updatedAt.toISOString() ?? "") !== version) return CONFLICT

      const now = new Date()
      const data = {
        termsOfService,
        termsPublished: pages.termsPublished,
        termsUpdatedAt: publishedAt(
          { text: termsOfService, published: pages.termsPublished },
          { text: saved?.termsOfService ?? null, published: saved?.termsPublished ?? false, at: saved?.termsUpdatedAt ?? null },
          now
        ),
        privacyPolicy,
        privacyPublished: pages.privacyPublished,
        privacyUpdatedAt: publishedAt(
          { text: privacyPolicy, published: pages.privacyPublished },
          { text: saved?.privacyPolicy ?? null, published: saved?.privacyPublished ?? false, at: saved?.privacyUpdatedAt ?? null },
          now
        ),
      }
      if (saved) {
        // The version again, in case another save landed since the read
        const { count } = await tx.legalPages.updateMany({ where: { id: "singleton", updatedAt: saved.updatedAt }, data })
        if (count === 0) return CONFLICT
      } else {
        await tx.legalPages.create({ data: { id: "singleton", ...data } })
      }
      return { success: true } satisfies ActionResponse
    })
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
