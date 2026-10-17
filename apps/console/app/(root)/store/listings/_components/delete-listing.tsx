"use client"

import { useState, useTransition } from "react"
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
import { deleteListingAction } from "@/lib/actions/listing.actions"

interface DeleteListingProps {
  listing: { id: string; name: string }
  storeId: string
  // From the store role on the server; deleteListingAction checks again
  canDelete: boolean
  // Order lines restrict the delete, so an ordered listing can only be archived
  hasOrders: boolean
}

export default function DeleteListing({ listing, storeId, canDelete, hasOrders }: DeleteListingProps) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleDelete = () => {
    startTransition(async () => {
      const response = await deleteListingAction({ id: listing.id, storeId })

      if (!response.success) {
        toast.add({ title: "Unable to remove the listing", description: response.error, type: "error" })
        // Already gone, so there's nothing to retry. Otherwise the dialog stays open so the user can retry or cancel on purpose.
        if (response.code === "NOT_FOUND") {
          setIsOpen(false)
          router.push("/store/listings")
        }
        return
      }

      setIsOpen(false)
      toast.add({ title: "Listing removed", description: `${listing.name} is no longer listed in this store.`, type: "success" })
      router.push("/store/listings")
    })
  }

  return (
    <div className="grid gap-2">
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogTrigger
          render={
            <Button type="button" className="w-full" variant="destructive" disabled={!canDelete || hasOrders}>
              Remove Listing
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>{`This action cannot be undone. ${listing.name} will be removed from this store, with its prices, stock and reviews here. The catalogue product isn't affected.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                handleDelete()
              }}
              disabled={isPending}
            >
              {isPending ? <Spinner /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shown as text because a disabled button never shows its title tooltip, and screen readers skip it */}
      {!canDelete && <p className="text-xs text-muted-foreground">Your role in this store cannot remove listings.</p>}
      {canDelete && hasOrders && <p className="text-xs text-muted-foreground">This listing has been ordered, so it can&apos;t be removed. Set its status to Archived instead.</p>}
    </div>
  )
}
