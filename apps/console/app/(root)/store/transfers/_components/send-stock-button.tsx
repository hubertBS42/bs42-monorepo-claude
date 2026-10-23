"use client"

import { Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import AddButton from "@/components/add-button"
import { useMemberRole } from "@/hooks/use-member-role"
import { TRANSFER_ROLES } from "@/lib/stock-transfer-status"

// Like StoreAddButton, but by role: sending needs owner or admin (of this store here; of the other one too, which the
// form's store list and the action check)
export default function SendStockButton({ storeId }: { storeId: string }) {
  const { role, isLoading } = useMemberRole(storeId)
  if (isLoading) return <Skeleton className="h-8 w-28 rounded-md" />
  if (role && TRANSFER_ROLES.includes(role)) return <AddButton label="Send Stock" url="/store/transfers/new" />

  return (
    <div className="grid justify-items-end gap-1">
      <Button type="button" size="sm" disabled>
        <Plus />
        <span className="hidden md:block">Send Stock</span>
      </Button>
      <p className="text-xs text-muted-foreground">Only the store&apos;s owners and admins can send stock.</p>
    </div>
  )
}
