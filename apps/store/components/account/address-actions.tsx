"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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

import { makeDefaultAddressAction, removeAddressAction } from "@/lib/actions/account.actions"

// A saved address's buttons: edit, make it the default, remove
export function AddressActions({ id, isDefault }: { id: string; isDefault: boolean }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState<"default" | "remove" | null>(null)

  const run = (kind: "default" | "remove", action: () => ReturnType<typeof removeAddressAction>) => {
    setBusy(kind)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.success) {
          toast.add({ title: kind === "remove" ? "Couldn't remove the address" : "Couldn't change your default", description: result.error, type: "error" })
          return
        }
        setIsOpen(false)
        router.refresh()
      } catch (error) {
        console.error("Changing a saved address failed:", error)
        toast.add({ title: "Something went wrong", description: "Please try again.", type: "error" })
      } finally {
        setBusy(null)
      }
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button render={<Link href={`/account/addresses/${id}`} />} variant="outline" size="sm" disabled={isPending}>
        Edit
      </Button>
      {!isDefault && (
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => run("default", () => makeDefaultAddressAction(id))}>
          {busy === "default" && <Spinner data-icon="inline-start" />}
          Make default
        </Button>
      )}
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" disabled={isPending} />}>Remove</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this address?</AlertDialogTitle>
            <AlertDialogDescription>{isDefault ? "It's your default address, so your newest other address becomes the default. " : ""}Orders already sent here aren't affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                run("remove", () => removeAddressAction(id))
              }}
            >
              {busy === "remove" && <Spinner data-icon="inline-start" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
