"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
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
import { toast } from "@workspace/ui/components/toast"
import { useMemberRole } from "@/hooks/use-member-role"
import { activateNextWorkspace } from "@/lib/activate-next-workspace"
import type { Store } from "@/types"

export default function DeleteStore({ store }: { store: Store }) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { role, isLoading } = useMemberRole(store.id)
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()

  if (isLoading || isSessionLoading) return <Skeleton className="h-9 rounded-md" />

  // getStoreById never returns the platform organization; this is defence in depth
  const isPlatformOrganization = store.slug === PLATFORM_ORGANIZATION_SLUG
  const canDelete =
    !isPlatformOrganization &&
    role !== null &&
    consoleAuthClient.organization.checkRolePermission({
      role,
      permissions: { organization: ["delete"] },
    })

  // Shown as text because a disabled button never shows its title tooltip, and screen readers skip it
  const disabledReason = isPlatformOrganization
    ? "The platform organization cannot be deleted."
    : role === null
      ? "You must be a member of this store to delete it."
      : !canDelete
        ? "Your role in this store cannot delete it."
        : null

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const { error } = await consoleAuthClient.organization.delete({ organizationId: store.id })
        if (error) throw new Error(error.message ?? "Unable to delete the store.")
      } catch (error) {
        // The dialog stays open so the user can retry or cancel on purpose
        toast.add({
          title: "Unable to delete the store",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
          type: "error",
        })
        return
      }

      toast.add({ title: "Store deleted", description: `${store.name} has been deleted.`, type: "success" })

      // Deleting the store you're working in clears the session's workspace, so pick the next one
      if (session?.session.activeOrganizationId === store.id) {
        try {
          await activateNextWorkspace(store.id, "/stores")
        } catch (error) {
          console.error("Could not switch workspace after deleting the store:", error)
          setIsOpen(false)
          toast.add({ title: "Unable to switch workspace", description: "Sign out and sign in again to choose a workspace.", type: "warning" })
        }
        return
      }

      setIsOpen(false)
      router.push("/stores")
      router.refresh()
    })
  }

  return (
    <div className="grid gap-2">
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogTrigger
          render={
            <Button type="button" className="w-full" variant="destructive" disabled={!canDelete}>
              Delete Store
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>{`This can't be undone. ${store.name}, its members and listings will be permanently deleted. Stores with orders can only be suspended.`}</AlertDialogDescription>
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

      {disabledReason && <p className="text-xs text-muted-foreground">{disabledReason}</p>}
    </div>
  )
}
