import type { ColumnDef } from "@tanstack/react-table"
import type { Status } from "@workspace/db/enums"
import { Badge } from "@workspace/ui/components/badge"
import { ColumnHeader } from "@workspace/tables"
import { formatDate } from "@workspace/utils/date"
import { capitalizeWord } from "@workspace/utils/text"
import type { BlogPostListItem } from "@/types"

// Archived is a normal end state, not an error, so it's muted rather than red
const statusBadgeVariants: Record<Status, "outline" | "success" | "secondary"> = {
  DRAFT: "outline",
  PUBLISHED: "success",
  ARCHIVED: "secondary",
}

export const columns: ColumnDef<BlogPostListItem, unknown>[] = [
  {
    accessorKey: "title",
    header: () => <ColumnHeader title="Title" sortKey="title" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image */}
          {row.original.image && <img alt="" src={row.original.image} loading="lazy" className="size-full object-cover" />}
        </div>
        <span className="min-w-40 whitespace-normal">{row.original.title}</span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" sortKey="status" />,
    cell: ({ row }) => <Badge variant={statusBadgeVariants[row.original.status]}>{capitalizeWord(row.original.status)}</Badge>,
  },
  {
    accessorKey: "publishedAt",
    header: () => <ColumnHeader title="Published" sortKey="publishedAt" />,
    cell: ({ row }) =>
      row.original.publishedAt ? (
        <span>{formatDate(row.original.publishedAt, "MMM d, yyyy")}</span>
      ) : (
        <span className="text-muted-foreground">
          <span aria-hidden="true">—</span>
          <span className="sr-only">Not published</span>
        </span>
      ),
  },
  {
    accessorKey: "updatedAt",
    header: () => <ColumnHeader title="Updated" sortKey="updatedAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.updatedAt, "MMM d, yyyy")}</span>,
  },
]
