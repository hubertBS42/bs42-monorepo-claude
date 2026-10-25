import type { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ColumnHeader } from "@workspace/tables"
import { capitalizeWord } from "@workspace/utils/text"
import type { Status } from "@workspace/db/enums"
import type { Brand } from "@workspace/db/client"

// Archived is a normal end state, not an error, so it's muted rather than red
const statusBadgeVariants: Record<Status, "outline" | "success" | "secondary"> = {
  DRAFT: "outline",
  PUBLISHED: "success",
  ARCHIVED: "secondary",
}

const genStatusBadge = (status: Status) => <Badge variant={statusBadgeVariants[status]}>{capitalizeWord(status)}</Badge>

export const columns: ColumnDef<Brand, unknown>[] = [
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
    accessorKey: "isFeatured",
    header: () => <ColumnHeader title="Featured" />,
    cell: ({ row }) =>
      row.original.isFeatured ? (
        <Badge variant="secondary">Featured</Badge>
      ) : (
        <span className="text-muted-foreground">
          <span aria-hidden="true">—</span>
          <span className="sr-only">Not featured</span>
        </span>
      ),
  },
  {
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="Created On" sortKey="createdAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy")}</span>,
  },
]
