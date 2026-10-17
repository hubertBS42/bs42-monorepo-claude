"use client"

import { useState, useTransition } from "react"
import { DoorOpen } from "lucide-react"
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
import { leaveStoreAction } from "@/lib/actions/member.actions"
import { activateNextWorkspace } from "@/lib/activate-next-workspace"
import type { Store } from "@/types"

export default function LeaveStore({ store }: { store: Store }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleLeave = () => {
    startTransition(async () => {
      try {
        const response = await leaveStoreAction({ storeId: store.id })

        if (!response.success) {
          // Retrying can't help the last owner, so close the dialog; otherwise it stays open to retry
          if (response.code === "LAST_OWNER") setIsOpen(false)
          toast.add({ title: "Unable to leave the store", description: response.error, type: "error" })
          return
        }
      } catch (error) {
        toast.add({
          title: "Unable to leave the store",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
          type: "error",
        })
        return
      }

      // Leaving clears the session's workspace, so pick the next one (or /no-stores)
      try {
        await activateNextWorkspace(store.id)
      } catch (error) {
        console.error("Could not switch workspace after leaving the store:", error)
        setIsOpen(false)
        toast.add({ title: `You left ${store.name}`, description: "Sign out and sign in again to choose a workspace.", type: "warning" })
      }
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" className="w-full" variant="destructive">
            <DoorOpen className="size-4" />
            Leave Store
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>{`You will be removed from ${store.name} and will lose access to all its resources.`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              event.preventDefault()
              handleLeave()
            }}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : "Leave"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
