"use client"

import { Plus } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import AddButton from "@/components/add-button"
import { useMemberRole } from "@/hooks/use-member-role"

type StorePermission = Parameters<typeof consoleAuthClient.organization.checkRolePermission>[0]["permissions"]

interface StoreAddButtonProps {
  storeId: string
  label: string
  url: string
  permission: StorePermission
  // Why the button is disabled, e.g. "Your role in this store can't add listings."
  deniedText: string
}

// An add button in the store workspace. Checks the store role itself, like the other action buttons; the add page and
// its action check again.
export default function StoreAddButton({ storeId, label, url, permission, deniedText }: StoreAddButtonProps) {
  const { role, isLoading } = useMemberRole(storeId)

  if (isLoading) return <Skeleton className="h-8 w-28 rounded-md" />

  const canCreate = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: permission })
  if (canCreate) return <AddButton label={label} url={url} />

  return (
    <div className="grid justify-items-end gap-1">
      <Button type="button" size="sm" disabled>
        <Plus />
        <span className="hidden md:block">{label}</span>
      </Button>
      {/* Shown as text because a disabled button never shows its title tooltip, and screen readers skip it */}
      <p className="text-xs text-muted-foreground">{deniedText}</p>
    </div>
  )
}
