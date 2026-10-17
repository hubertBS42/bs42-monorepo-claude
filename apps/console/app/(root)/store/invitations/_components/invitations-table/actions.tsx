"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleSlash, Repeat2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cancelInvitationAction, resendInvitationAction } from "@/lib/actions/invitation.actions"
import type { InvitationForTable } from "@/types"

interface InvitationActionsProps {
  invitation: InvitationForTable
  canResend: boolean
  canCancel: boolean
}

const InvitationActions = ({ invitation, canResend, canCancel }: InvitationActionsProps) => {
  const [isPending, startTransition] = useTransition()
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const router = useRouter()

  if (!canResend && !canCancel) return null

  const handleResend = () => {
    startTransition(async () => {
      const response = await resendInvitationAction(invitation.id)

      if (!response.success) {
        toast.add({ title: "Unable to resend the invitation", description: response.error, type: "error" })
        return
      }

      toast.add({ title: "Invitation resent", description: `A new invitation email has been sent to ${invitation.email}.`, type: "success" })
      router.refresh()
    })
  }

  const handleCancel = () => {
    startTransition(async () => {
      const response = await cancelInvitationAction(invitation.id)

      if (!response.success) {
        // The dialog stays open so the user can retry or cancel on purpose
        toast.add({ title: "Unable to cancel the invitation", description: response.error, type: "error" })
        return
      }

      setIsCancelOpen(false)
      toast.add({ title: "Invitation cancelled", description: `The invitation sent to ${invitation.email} can no longer be used.`, type: "success" })
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {canResend && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Resend the invitation to ${invitation.email}`} disabled={isPending} onClick={handleResend}>
                {isPending && !isCancelOpen ? <Spinner /> : <Repeat2 className="size-4" />}
              </Button>
            }
          />
          <TooltipContent>Resend (renews the expiry)</TooltipContent>
        </Tooltip>
      )}

      {canCancel && (
        <AlertDialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
          <Tooltip>
            <TooltipTrigger
              render={
                <AlertDialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Cancel the invitation to ${invitation.email}`}
                      disabled={isPending}
                    >
                      <CircleSlash className="size-4" />
                    </Button>
                  }
                />
              }
            />
            <TooltipContent>Cancel</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this invitation?</AlertDialogTitle>
              <AlertDialogDescription>{`${invitation.email} will no longer be able to join the store with this invitation. You can invite them again later.`}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Keep</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(event) => {
                  event.preventDefault()
                  handleCancel()
                }}
                disabled={isPending}
              >
                {isPending ? <Spinner /> : "Cancel Invitation"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

export default InvitationActions
