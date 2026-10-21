import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isGoogleSignInEnabled } from "@workspace/auth/store"
import { getStringParam } from "@workspace/utils/search-params"

import { SignInForm } from "@/components/account/sign-in-form"
import { safeRedirect } from "@/lib/auth-redirect"
import type { SearchParams } from "@/lib/catalogue-filters"
import { getStoreSession } from "@/lib/session"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

// ?redirect= is where to go afterwards; ?error=google when Google sent the customer back without signing in
export default async function SignInPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [query, session] = await Promise.all([searchParams, getStoreSession()])
  const redirectTo = safeRedirect(getStringParam(query.redirect))
  if (session) redirect(redirectTo)

  const notice = getStringParam(query.error) ? "We couldn't sign you in with Google. Please try again, or use your email." : null
  return <SignInForm redirectTo={redirectTo} googleEnabled={isGoogleSignInEnabled} notice={notice} />
}
