import "server-only"

import { prisma } from "@workspace/db"

// The storefront's Terms and Privacy pages for the Legal card, with dates as strings for the client component
export interface LegalPagesView {
  // The row's updatedAt, or "" before the first save: the Legal card sends it back
  version: string
  termsOfService: string | null
  termsUpdatedAt: string | null
  privacyPolicy: string | null
  privacyUpdatedAt: string | null
}

export async function getLegalPages(): Promise<LegalPagesView> {
  const row = await prisma.legalPages.findUnique({ where: { id: "singleton" } })
  return {
    version: row?.updatedAt.toISOString() ?? "",
    termsOfService: row?.termsOfService ?? null,
    termsUpdatedAt: row?.termsUpdatedAt?.toISOString() ?? null,
    privacyPolicy: row?.privacyPolicy ?? null,
    privacyUpdatedAt: row?.privacyUpdatedAt?.toISOString() ?? null,
  }
}
