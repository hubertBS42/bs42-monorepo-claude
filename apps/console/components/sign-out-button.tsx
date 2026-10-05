"use client"

import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { useSignOut } from "@/hooks/use-sign-out"

export default function SignOutButton({ variant = "outline" }: { variant?: React.ComponentProps<typeof Button>["variant"] }) {
  const { signOut, isSigningOut, signOutError } = useSignOut()

  return (
    <div className="grid gap-2">
      <Button variant={variant} onClick={() => void signOut()} disabled={isSigningOut}>
        {isSigningOut ? <Spinner /> : "Log out"}
      </Button>
      {signOutError && (
        <p role="alert" className="text-sm text-destructive">
          {signOutError}
        </p>
      )}
    </div>
  )
}
