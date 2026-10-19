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
import { consoleAuthClient } from "@workspace/auth/console-client"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useMemberRole } from "@/hooks/use-member-role"
import { deleteListingAction } from "@/lib/actions/listing.actions"

interface DeleteListingProps {
  listing: { id: string; name: string }
  storeId: string
  // Order and purchase order lines restrict the delete, so a listing that has been ordered or bought in can only be archived
  hasOrders: boolean
}

// Checks the store role itself, like the other action buttons; deleteListingAction checks again
export default function DeleteListing({ listing, storeId, hasOrders }: DeleteListingProps) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { role, isLoading } = useMemberRole(storeId)

  if (isLoading) return <Skeleton className="h-9 rounded-md" />
  const canDelete = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { listing: ["delete"] } })

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
      {canDelete && hasOrders && <p className="text-xs text-muted-foreground">This listing has been ordered or bought in, so it can&apos;t be removed. Set its status to Archived instead.</p>}
    </div>
  )
}
