import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isGoogleSignInEnabled } from "@workspace/auth/store"
import { getStringParam } from "@workspace/utils/search-params"

import { SignInForm } from "@/components/account/sign-in-form"
import { safeRedirect } from "@/lib/auth-redirect"
import type { SearchParams } from "@/lib/catalogue-filters"
import { getStoreSession } from "@/lib/session"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

// ?redirect= is where to go afterwards; ?error= is Better Auth's code when Google sent the customer back without signing
// them in. Only the code is read, never its error_description: a link's text isn't the site's to show.
function googleNotice(error: string | string[] | undefined) {
  const codes = typeof error === "string" ? [error] : (error ?? [])
  if (codes.length === 0) return null
  // As the email form says it (components/account/sign-in-form.tsx)
  if (codes.includes("BANNED_USER")) return "This account has been suspended. Please contact us."
  return "Google sign-in didn't go through. Please try again, or use your email."
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [query, session] = await Promise.all([searchParams, getStoreSession()])
  const redirectTo = safeRedirect(getStringParam(query.redirect))
  if (session) redirect(redirectTo)

  const notice = googleNotice(query.error)
  return <SignInForm redirectTo={redirectTo} googleEnabled={isGoogleSignInEnabled} notice={notice} />
}
