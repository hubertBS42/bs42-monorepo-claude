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
import { deleteSupplierAction } from "@/lib/actions/supplier.actions"

interface DeleteSupplierProps {
  storeId: string
  // Purchase orders restrict the delete, so a supplier that has been used can only be archived
  supplier: { id: string; name: string; purchaseOrderCount: number }
}

// Checks the store role itself, like the other action buttons; deleteSupplierAction checks again
export default function DeleteSupplier({ storeId, supplier }: DeleteSupplierProps) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { role, isLoading } = useMemberRole(storeId)

  if (isLoading) return <Skeleton className="h-9 rounded-md" />
  const canDelete = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { supplier: ["delete"] } })
  const isUsed = supplier.purchaseOrderCount > 0

  const handleDelete = () => {
    startTransition(async () => {
      const response = await deleteSupplierAction({ storeId, id: supplier.id })

      if (!response.success) {
        toast.add({ title: "Unable to delete the supplier", description: response.error, type: "error" })
        // Already gone, so there's nothing to retry. Otherwise the dialog stays open so the user can retry or cancel on purpose.
        if (response.code === "NOT_FOUND") {
          setIsOpen(false)
          router.push("/store/suppliers")
        }
        return
      }

      setIsOpen(false)
      toast.add({ title: "Supplier deleted", description: `${supplier.name} has been deleted.`, type: "success" })
      router.push("/store/suppliers")
    })
  }

  return (
    <div className="grid gap-2">
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogTrigger
          render={
            <Button type="button" className="w-full" variant="destructive" disabled={!canDelete || isUsed}>
              Delete Supplier
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>{`This action cannot be undone. ${supplier.name} will be permanently deleted.`}</AlertDialogDescription>
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
      {!canDelete && <p className="text-xs text-muted-foreground">Your role in this store cannot delete suppliers.</p>}
      {canDelete && isUsed && <p className="text-xs text-muted-foreground">This supplier is on purchase orders, so it can&apos;t be deleted. Archive it instead.</p>}
    </div>
  )
}
