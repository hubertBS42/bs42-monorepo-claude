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
import type { Category } from "@workspace/db/client"
import { deleteCategoryAction } from "@/lib/actions/category.actions"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { useRouter } from "next/navigation"

interface DeleteCategoryProps {
  category: Pick<Category, "id" | "name">
  // From getCategoryById. A category with subcategories can't be deleted until they are moved or deleted.
  childCount: number
}

export default function DeleteCategory({ category, childCount }: DeleteCategoryProps) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()

  if (isSessionLoading) return <Skeleton className="h-9 rounded-md" />

  // hasSystemPermission, not checkRolePermission: roles can be comma-separated. deleteCategoryAction checks again on the server.
  const canDelete = hasSystemPermission(session?.user.role, { category: ["delete"] })
  const hasChildren = childCount > 0

  const handleDelete = () => {
    startTransition(async () => {
      const response = await deleteCategoryAction(category.id)

      if (!response.success) {
        // The dialog stays open so the user can retry or cancel on purpose
        toast.add({ title: "Operation failed", description: response.error, type: "error" })
        return
      }

      setIsOpen(false)
      toast.add({ title: "Category deleted", description: `${category.name} has been deleted.`, type: "success" })
      router.push("/catalogue/categories")
    })
  }

  return (
    <div className="grid gap-2">
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogTrigger
          render={
            <Button type="button" className="w-full" variant="destructive" disabled={!canDelete || hasChildren}>
              Delete Category
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>{`This action cannot be undone. ${category.name} will be permanently deleted.`}</AlertDialogDescription>
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
      {!canDelete ? (
        <p className="text-xs text-muted-foreground">Your role cannot delete categories.</p>
      ) : (
        hasChildren && <p className="text-xs text-muted-foreground">{`Move or delete its ${childCount} ${childCount === 1 ? "subcategory" : "subcategories"} first.`}</p>
      )}
    </div>
  )
}
