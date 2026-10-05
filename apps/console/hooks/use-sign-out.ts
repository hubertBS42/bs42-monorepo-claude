"use client"

import { consoleAuthClient } from "@workspace/auth/console-client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function useSignOut() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  async function signOut() {
    setIsSigningOut(true)
    setSignOutError(null)

    try {
      const result = await consoleAuthClient.signOut()
      if (result.error) {
        setSignOutError("Unable to log out. Please try again.")
        setIsSigningOut(false)
        return
      }

      router.replace("/login")
      router.refresh()
    } catch (error) {
      console.error("Console sign-out failed:", error)
      setSignOutError("Unable to log out. Please try again.")
      setIsSigningOut(false)
    }
  }

  return { signOut, isSigningOut, signOutError }
}
