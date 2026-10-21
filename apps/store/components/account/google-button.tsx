"use client"

import { useState } from "react"
import { storeAuthClient } from "@workspace/auth/store-client"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

// Google accounts arrive verified, so there's no email to confirm. A first sign-in makes the account.
export function GoogleButton({ redirectTo, label }: { redirectTo: string; label: string }) {
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setIsRedirecting(true)
    setError(null)
    const result = await storeAuthClient.signIn.social({ provider: "google", callbackURL: redirectTo, errorCallbackURL: "/sign-in?error=google" }).catch(() => null)
    // On success the browser is already on its way to Google
    if (!result || result.error) {
      setError("We couldn't reach Google. Please try again.")
      setIsRedirecting(false)
    }
  }

  return (
    <>
      <Button variant="outline" type="button" disabled={isRedirecting} onClick={() => void signIn()}>
        {isRedirecting ? (
          <Spinner />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
        )}
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  )
}
