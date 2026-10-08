"use client"
import { Store } from "@/types"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import type { OrgRole } from "@workspace/auth/organization-permissions"
import { toast } from "@workspace/ui/components/toast"
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
import { Spinner } from "@workspace/ui/components/spinner"

export default function DeleteStore({ store }: { store: Store }) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const [role, setRole] = useState<OrgRole | null>(null)
  const [isRoleLoading, setIsRoleLoading] = useState(true)

  useEffect(() => {
    let isCurrent = true

    void consoleAuthClient.organization
      .getActiveMemberRole({
        query: { organizationId: store.id },
      })
      .then(({ data, error }) => {
        if (!isCurrent) return

        if (error) {
          toast.add({
            title: "Unable to check store permissions",
            description: error.message,
            type: "error",
          })
        } else if (data) {
          setRole(data.role as OrgRole)
        }
        setIsRoleLoading(false)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return

        toast.add({
          title: "Unable to check store permissions",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
          type: "error",
        })
        setIsRoleLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [store.id])

  if (isRoleLoading) return <Skeleton className="h-9 rounded-md" />

  const isPlatformOrganization = store.slug === PLATFORM_ORGANIZATION_SLUG
  const canDelete =
    !isPlatformOrganization &&
    role !== null &&
    consoleAuthClient.organization.checkRolePermission({
      role,
      permissions: {
        organization: ["delete"],
      },
    })

  const handleDelete = () => {
    startTransition(async () => {
      await consoleAuthClient.organization.delete(
        {
          organizationId: store.id,
        },
        {
          onSuccess: () => {
            startTransition(() => {
              setIsOpen(false)
              toast.add({
                title: "Store deleted",
                description: "Store has been deleted.",
                type: "success",
              })

              router.push("/stores")
            })
          },
          onError: (ctx) => {
            startTransition(() => {
              setIsOpen(false)
              toast.add({
                title: "Error",
                description: ctx.error.message,
                type: "error",
              })
            })
          },
        }
      )
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            className="w-full"
            variant={"destructive"}
            disabled={!canDelete}
            title={isPlatformOrganization ? "The platform organization cannot be deleted" : role === null ? "You must be a member of this store to delete it" : undefined}
          >
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
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
