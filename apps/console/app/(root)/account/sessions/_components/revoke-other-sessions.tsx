"use client"

import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { revokeOtherSessionsAction } from "@/lib/actions/account.actions"

const RevokeOtherSessions = () => {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleClick = () => {
    startTransition(async () => {
      const result = await revokeOtherSessionsAction()
      if (!result.success) {
        toast.add({ title: "Failed to sign out other sessions", description: result.error, type: "error" })
        return
      }
      toast.add({ title: "Signed out of all other sessions", type: "success" })
      router.refresh()
    })
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
      {isPending ? <Spinner /> : "Sign out other sessions"}
    </Button>
  )
}

export default RevokeOtherSessions
