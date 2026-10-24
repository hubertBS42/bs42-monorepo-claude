"use client"

import { consoleAuthClient } from "@workspace/auth/console-client"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { acceptInvitationAction, rejectInvitationAction } from "@/lib/actions/invitation.actions"
import { InvitationDetails } from "@/types"

const AcceptInvitationUI = ({ invitation }: { invitation: InvitationDetails }) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<"accept" | "reject" | null>(null)

  const handleAccept = () => {
    setAction("accept")
    startTransition(async () => {
      const response = await acceptInvitationAction({
        invitationId: invitation.id,
      })

      if (!response.success) {
        toast.add({
          title: "Operation failed",
          description: response.error,
          type: "error",
        })

        return
      }

      // Set the accepted organization as active
      const { error } = await consoleAuthClient.organization.setActive({
        organizationId: invitation.organizationId,
      })
      toast.add({
        title: "Operation success",
        description: error ? "Invitation accepted. Switch to the store from the store switcher." : "Invitation accepted.",
        type: "success",
      })
      router.push("/")
      router.refresh()
    })
  }

  const handleReject = () => {
    setAction("reject")
    startTransition(async () => {
      const response = await rejectInvitationAction({
        invitationId: invitation.id,
      })

      if (!response.success) {
        toast.add({
          title: "Operation failed",
          description: response.error,
          type: "error",
        })
        return
      }

      toast.add({
        title: "Operation success",
        description: "Invitation rejected.",
        type: "success",
      })
      router.push("/")
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="grid w-full max-w-md gap-6 p-6 text-center">
        <div className="grid gap-2">
          <h1 className="text-2xl font-bold">You have been invited</h1>
          <p className="text-sm text-muted-foreground">{`${invitation.inviter.name ?? invitation.inviter.email} invited you to join ${invitation.organization.name} as ${invitation.role}.`}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleReject} disabled={isPending}>
            {isPending && action === "reject" ? <Spinner /> : "Decline"}
          </Button>
          <Button className="flex-1" onClick={handleAccept} disabled={isPending}>
            {isPending && action === "accept" ? <Spinner /> : "Accept"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AcceptInvitationUI
