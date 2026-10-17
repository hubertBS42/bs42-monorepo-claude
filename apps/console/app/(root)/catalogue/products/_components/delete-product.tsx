"use client"

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
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState, useTransition } from "react"
import { toast } from "@workspace/ui/components/toast"
import { deleteProductAction } from "@/lib/actions/product.actions"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { useRouter } from "next/navigation"

interface DeleteProductProps {
  product: { id: string; name: string }
  // Store listings cascade with the product, so the dialog says how many stores lose it
  storeCount: number
  // Order lines restrict the delete, so an ordered product can only be archived
  hasOrders: boolean
}

export default function DeleteProduct({ product, storeCount, hasOrders }: DeleteProductProps) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()

  if (isSessionLoading) return <Skeleton className="h-9 rounded-md" />

  // hasSystemPermission, not checkRolePermission: roles can be comma-separated. deleteProductAction checks again on the server.
  const canDelete = hasSystemPermission(session?.user.role, { product: ["delete"] })

  const handleDelete = () => {
    startTransition(async () => {
      const response = await deleteProductAction(product.id)

      if (!response.success) {
        // The dialog stays open so the user can retry or cancel on purpose
        toast.add({ title: "Operation failed", description: response.error, type: "error" })
        return
      }

      setIsOpen(false)
      toast.add({ title: "Product deleted", description: `${product.name} has been deleted.`, type: "success" })
      router.push("/catalogue/products")
    })
  }

  const listingWarning = storeCount > 0 ? ` It is listed in ${storeCount === 1 ? "1 store" : `${storeCount} stores`}, which will lose it along with their prices and stock.` : ""

  return (
    <div className="grid gap-2">
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogTrigger
          render={
            <Button type="button" className="w-full" variant="destructive" disabled={!canDelete || hasOrders}>
              Delete Product
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>{`This action cannot be undone. ${product.name} will be permanently deleted.${listingWarning}`}</AlertDialogDescription>
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
              {isPending ? <Spinner /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shown as text because a disabled button never shows its title tooltip, and screen readers skip it */}
      {!canDelete && <p className="text-xs text-muted-foreground">Your role cannot delete products.</p>}
      {canDelete && hasOrders && <p className="text-xs text-muted-foreground">This product has been ordered, so it can&apos;t be deleted. Set its status to Archived instead.</p>}
    </div>
  )
}
