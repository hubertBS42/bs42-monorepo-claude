import type { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"
import { Badge } from "@workspace/ui/components/badge"
import { ColumnHeader } from "@workspace/tables"
import { capitalizeWord } from "@workspace/utils/text"
import type { Status } from "@workspace/db/enums"
import type { CategoryNode } from "@/types"

// Archived is a normal end state, not an error, so it's muted rather than red
const statusBadgeVariants: Record<Status, "outline" | "success" | "secondary"> = {
  DRAFT: "outline",
  PUBLISHED: "success",
  ARCHIVED: "secondary",
}

const genStatusBadge = (status: Status) => <Badge variant={statusBadgeVariants[status]}>{capitalizeWord(status)}</Badge>

export const columns: ColumnDef<CategoryNode, unknown>[] = [
  {
    accessorKey: "name",
    header: () => (
      <div className="lg:w-100">
        <ColumnHeader title="Name" />
      </div>
    ),
  },
  {
    accessorKey: "slug",
    header: () => <ColumnHeader title="Slug" />,
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" />,
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
    header: () => <ColumnHeader title="Created On" />,
    cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy")}</span>,
  },
]
