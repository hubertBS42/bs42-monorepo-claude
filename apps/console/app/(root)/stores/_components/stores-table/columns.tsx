import { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"

import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { cn } from "@workspace/ui/lib/utils"
import { ColumnHeader } from "@workspace/tables"
import { Store, StoreStatus } from "@/types"
import { capitalizeWord } from "@workspace/utils/text"

const genStatusBadge = (status: StoreStatus) => {
  const statusConfig: Record<StoreStatus, { className: string }> = {
    ACTIVE: {
      className: "border-transparent bg-green-600/10 text-green-700 dark:bg-green-400/10 dark:text-green-400",
    },
    SUSPENDED: { className: "" },
  }

  const config = statusConfig[status] ?? statusConfig.ACTIVE
  const variant = status === "SUSPENDED" ? "destructive" : "outline"

  return (
    <Badge variant={variant} className={cn(config.className)}>
      {capitalizeWord(status)}
    </Badge>
  )
}

export const columns: ColumnDef<Store, unknown>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" onClick={(e) => e.stopPropagation()} />,
    enableSorting: false,
    enableHiding: false,
  },
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
    cell: ({ row }) => {
      const dateTime: Date = row.original.createdAt
      const formatted = formatDate(dateTime, "MMM d, yyyy, h:mm a")
      return <span>{formatted}</span>
    },
  },
]
