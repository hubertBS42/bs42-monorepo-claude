import type { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"

import { Badge } from "@workspace/ui/components/badge"
import { ColumnHeader } from "@workspace/tables"
import type { Store, StoreStatus } from "@/types"
import { capitalizeWord } from "@workspace/utils/text"

const statusBadgeVariants: Record<StoreStatus, "success" | "destructive"> = {
  ACTIVE: "success",
  SUSPENDED: "destructive",
}

const genStatusBadge = (status: StoreStatus) => <Badge variant={statusBadgeVariants[status]}>{capitalizeWord(status)}</Badge>

export const columns: ColumnDef<Store, unknown>[] = [
  {
    accessorKey: "name",
    header: () => <ColumnHeader title="Name" sortKey="name" />,
  },
  {
    accessorKey: "slug",
    header: () => <ColumnHeader title="Slug" />,
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" sortKey="status" />,
    cell: ({ row }) => genStatusBadge(row.original.status),
  },
  {
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="Created On" sortKey="createdAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy")}</span>,
  },
]
