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

// When a text last changed: now if it changed, kept if not, none once it's removed
const changedAt = (text: string | null, saved: string | null, savedAt: Date | null, now: Date) => (!text ? null : text === saved ? savedAt : now)

// Saves the storefront's Terms and Privacy pages. The storefront shows them, and links to them, within a minute (its
// caches only expire).
export async function saveLegalPagesAction(input: z.input<typeof saveLegalPagesSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ appSettings: ["update"] })

  try {
    const parsed = saveLegalPagesSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
    const { version, pages } = parsed.data
    const termsOfService = sanitizeRichText(pages.termsOfService)
    const privacyPolicy = sanitizeRichText(pages.privacyPolicy)

    return await prisma.$transaction(async (tx) => {
      const saved = await tx.legalPages.findUnique({ where: { id: "singleton" } })
      // Only from the version the page showed: the row's updatedAt, or no row at all before the first save
      if ((saved?.updatedAt.toISOString() ?? "") !== version) return CONFLICT

      const now = new Date()
      const data = {
        termsOfService,
        termsUpdatedAt: changedAt(termsOfService, saved?.termsOfService ?? null, saved?.termsUpdatedAt ?? null, now),
        privacyPolicy,
        privacyUpdatedAt: changedAt(privacyPolicy, saved?.privacyPolicy ?? null, saved?.privacyUpdatedAt ?? null, now),
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
