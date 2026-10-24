import type { Metadata } from "next"
import Link from "next/link"
import { CircleCheck, MailX } from "lucide-react"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { getStringParam } from "@workspace/utils/search-params"

import { safeRedirect, signInHref } from "@/lib/auth-redirect"
import type { SearchParams } from "@/lib/catalogue-filters"
import { getStoreSession } from "@/lib/session"

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } }

// Where the confirmation email's link lands: signed in once it worked, or with ?error= (invalid_token, token_expired)
// when the link is too old or already used. Signing in again sends a new one.
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [query, session] = await Promise.all([searchParams, getStoreSession()])
  const redirectTo = safeRedirect(getStringParam(query.redirect))
  const verified = !getStringParam(query.error) && session?.user.emailVerified

  return (
    <Card>
      <CardHeader className="text-center">
        {verified ? <CircleCheck className="mx-auto mb-2 size-8 text-primary" aria-hidden /> : <MailX className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />}
        <CardTitle className="text-xl">{verified ? "Your email is confirmed" : "This link has expired"}</CardTitle>
        <CardDescription>{verified ? `Thanks, ${session.user.name.split(" ")[0]}. You're signed in.` : "This link has expired or been used. Sign in to get a new one."}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={verified ? redirectTo : signInHref("/sign-in", redirectTo)} className={buttonVariants({ className: "w-full" })}>
          {verified ? (redirectTo === "/" ? "Start shopping" : "Continue") : "Sign in"}
        </Link>
      </CardContent>
    </Card>
  )
}
