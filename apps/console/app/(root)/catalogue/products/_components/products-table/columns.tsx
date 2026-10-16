/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */
import type { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ColumnHeader } from "@workspace/tables"
import { capitalizeWord } from "@workspace/utils/text"
import type { Status, Condition } from "@workspace/db/enums"
import type { ProductListItem } from "@/types"
import { formatCurrency } from "@workspace/utils/currency"
import { CONDITION_LABELS } from "@/constants"

// Archived is a normal end state, not an error, so it's muted rather than red
const statusBadgeVariants: Record<Status, "outline" | "success" | "secondary"> = {
  DRAFT: "outline",
  PUBLISHED: "success",
  ARCHIVED: "secondary",
}

// Badge has too few variants for five conditions, so each gets its own tint in the style of the success variant.
// Condition isn't an error state, so none of them is red.
const conditionBadgeClasses: Record<Condition, string> = {
  NEW: "bg-green-600/10 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  USED_LIKE_NEW: "bg-teal-600/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-400",
  REFURBISHED: "bg-blue-600/10 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  USED_GOOD: "bg-amber-600/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  USED_FAIR: "bg-orange-600/10 text-orange-700 dark:bg-orange-400/10 dark:text-orange-400",
}

const genStatusBadge = (status: Status) => <Badge variant={statusBadgeVariants[status]}>{capitalizeWord(status)}</Badge>
const genConditionBadge = (condition: Condition) => (
  <Badge variant="secondary" className={conditionBadgeClasses[condition]}>
    {CONDITION_LABELS[condition]}
  </Badge>
)

export const columns: ColumnDef<ProductListItem, unknown>[] = [
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
    cell: ({ row }) => {
      const image = row.original.images[0]
      return (
        <div className="flex items-center gap-x-3">
          <div className="relative size-10 overflow-hidden rounded bg-muted">{image && <img alt="" src={image} loading="lazy" className="size-full object-cover" />}</div>
          <div className="grid gap-y-0.5">
            <span>{row.original.name}</span>
            <span className="text-[11px] text-muted-foreground">{row.original.brand.name}</span>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "baseSellPrice",
    header: () => <ColumnHeader title="Sell Price" sortKey="baseSellPrice" />,
    cell: ({ row }) => formatCurrency(row.original.baseSellPrice),
  },
  {
    accessorKey: "category",
    header: () => <ColumnHeader title="Category" />,
    cell: ({ row }) => {
      const category = row.original.category
      return <Badge variant="outline">{category.name}</Badge>
    },
  },
  {
    accessorKey: "condition",
    header: () => <ColumnHeader title="Condition" sortKey="condition" />,
    cell: ({ row }) => genConditionBadge(row.original.condition),
  },
  {
    accessorKey: "hasVariants",
    header: () => <ColumnHeader title="Type" />,
    cell: ({ row }) => (row.original.hasVariants ? <Badge variant="secondary">Variable</Badge> : <Badge variant="outline">Simple</Badge>),
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" sortKey="status" />,
    cell: ({ row }) => genStatusBadge(row.original.status),
  },
  {
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="Created On" sortKey="createdAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy, h:mm a")}</span>,
  },
]
