"use client"

import { useState } from "react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

// Signs out the current account and opens the invitation again, which then sends the visitor to sign-up
// or login for the invited email
export default function SwitchAccountButton({ invitationId }: { invitationId: string }) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setIsSigningOut(true)
    setError(null)

    try {
      const result = await consoleAuthClient.signOut()
      if (result.error) throw new Error(result.error.message)

      // A full page load, so the server sees the signed-out request
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/accept-invitation/${encodeURIComponent(invitationId)}`
    } catch (error) {
      console.error("Sign-out before accepting an invitation failed:", error)
      setError("Unable to sign out. Please try again.")
      setIsSigningOut(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Button onClick={() => void handleClick()} disabled={isSigningOut}>
        {isSigningOut ? <Spinner /> : "Sign out and continue"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
