"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { consoleAuthClient } from "@workspace/auth/console-client"
import type { OrgRole } from "@workspace/auth/organization-permissions"
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
import type { Store } from "@/types"

/**
 * The current user's role in the given store, or null when they aren't a member.
 * The result is keyed by organization id, so changing the id counts as loading
 * again and a stale role is never used for the wrong store.
 */
function useMemberRole(organizationId: string) {
  const [result, setResult] = useState<{ organizationId: string; role: OrgRole | null } | null>(null)

  useEffect(() => {
    let isCurrent = true

    const fail = (message: string) => {
      if (!isCurrent) return
      toast.add({ title: "Unable to check store permissions", description: message, type: "error" })
      setResult({ organizationId, role: null })
    }

    consoleAuthClient.organization
      .getActiveMemberRole({ query: { organizationId } })
      .then(({ data, error }) => {
        if (error) return fail(error.message ?? "An unexpected error occurred.")
        if (isCurrent) setResult({ organizationId, role: (data?.role as OrgRole | undefined) ?? null })
      })
      .catch((error: unknown) => fail(error instanceof Error ? error.message : "An unexpected error occurred."))

    return () => {
      isCurrent = false
    }
  }, [organizationId])

  const current = result?.organizationId === organizationId ? result : null
  return { role: current?.role ?? null, isLoading: current === null }
}

export default function DeleteStore({ store }: { store: Store }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { role, isLoading } = useMemberRole(store.id)

  if (isLoading) return <Skeleton className="h-9 rounded-md" />

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

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const { error } = await consoleAuthClient.organization.delete({ organizationId: store.id })
      if (error) throw new Error(error.message ?? "Unable to delete the store.")

      setIsOpen(false)
      toast.add({ title: "Store deleted", description: "Store has been deleted.", type: "success" })
      router.push("/stores")
    } catch (error) {
      // The dialog stays open so the user can retry or cancel on purpose
      toast.add({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to delete the store.",
        type: "error",
      })
    } finally {
      setIsDeleting(false)
    }
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
            <AlertDialogDescription>{`This action cannot be undone. ${store.name} and all related data will be permanently deleted.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              disabled={isDeleting}
            >
              {isDeleting ? <Spinner /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {disabledReason && <p className="text-xs text-muted-foreground">{disabledReason}</p>}
    </div>
  )
}
