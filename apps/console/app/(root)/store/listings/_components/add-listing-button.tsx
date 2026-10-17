"use client"

import { Plus } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import AddButton from "@/components/add-button"
import { useMemberRole } from "@/hooks/use-member-role"

// Checks the store role itself, like the other action buttons; the add page and createListingAction check again
export default function AddListingButton({ storeId }: { storeId: string }) {
  const { role, isLoading } = useMemberRole(storeId)

  if (isLoading) return <Skeleton className="h-8 w-28 rounded-md" />

  const canCreate = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { listing: ["create"] } })
  if (canCreate) return <AddButton label="Add Listing" url="/store/listings/add" />

  return (
    <div className="grid justify-items-end gap-1">
      <Button type="button" size="sm" disabled>
        <Plus />
        <span className="hidden md:block">Add Listing</span>
      </Button>
      {/* Shown as text because a disabled button never shows its title tooltip, and screen readers skip it */}
      <p className="text-xs text-muted-foreground">Your role in this store can&apos;t add listings.</p>
    </div>
  )
}
