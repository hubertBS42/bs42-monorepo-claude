import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isGoogleSignInEnabled } from "@workspace/auth/store"
import { getStringParam } from "@workspace/utils/search-params"

import { SignUpForm } from "@/components/account/sign-up-form"
import { legalLinks } from "@/components/legal-consent"
import { safeRedirect } from "@/lib/auth-redirect"
import type { SearchParams } from "@/lib/catalogue-filters"
import { getStoreSession } from "@/lib/session"
import { getLegalPages } from "@/lib/settings"

export const metadata: Metadata = { title: "Create an account", robots: { index: false } }

export default async function SignUpPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [query, session, legal] = await Promise.all([searchParams, getStoreSession(), getLegalPages()])
  const redirectTo = safeRedirect(getStringParam(query.redirect))
  if (session) redirect(redirectTo)

  return <SignUpForm redirectTo={redirectTo} googleEnabled={isGoogleSignInEnabled} legal={legalLinks(legal)} />
}
