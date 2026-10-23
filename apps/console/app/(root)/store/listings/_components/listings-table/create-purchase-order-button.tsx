"use client"

import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMemberRole } from "@/hooks/use-member-role"
import type { ListingListItem } from "@/types"

// For the listings ticked in the table, e.g. after filtering to low stock: a new purchase order starting with them
// (the create page suggests quantities). Checks the store role itself; the create page checks again.
export default function CreatePurchaseOrderButton({ storeId, listings }: { storeId: string; listings: ListingListItem[] }) {
  const { role, isLoading } = useMemberRole(storeId)

  if (isLoading) return <Skeleton className="h-8 w-44 rounded-md" />

  const canCreate = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { purchaseOrder: ["create"] } })
  if (!canCreate) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Your role in this store can&apos;t create purchase orders.</span>
        <Button type="button" size="sm" variant="outline" disabled>
          <ClipboardList />
          Create purchase order
        </Button>
      </div>
    )
  }

  return (
    <Link href={`/store/purchase-orders/create?listings=${listings.map((listing) => listing.id).join(",")}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
      <ClipboardList />
      Create purchase order
    </Link>
  )
}
