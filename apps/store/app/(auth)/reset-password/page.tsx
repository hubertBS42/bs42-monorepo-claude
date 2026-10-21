import type { Metadata } from "next"
import { getStringParam } from "@workspace/utils/search-params"

import { ResetPasswordForm } from "@/components/account/reset-password-form"
import type { SearchParams } from "@/lib/catalogue-filters"

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } }

// Open signed in too: the link is for whoever has the email, and resetting signs every session out
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams
  const token = getStringParam(query.error) ? null : (getStringParam(query.token) ?? null)
  return <ResetPasswordForm token={token} />
}
