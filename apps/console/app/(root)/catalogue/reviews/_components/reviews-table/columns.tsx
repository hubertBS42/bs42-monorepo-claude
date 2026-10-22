import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Star } from "lucide-react"
import { ReviewStatus } from "@workspace/db/enums"
import { ColumnHeader } from "@workspace/tables"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { formatDate } from "@workspace/utils/date"
import type { ReviewRow } from "@/types"
import ReviewActions from "./actions"

function Rating({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((index) => (
        <Star key={index} aria-hidden className={index <= rating ? "size-3.5 text-amber-500" : "size-3.5 text-muted-foreground/30"} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  )
}

// Null while the session loads
export function getColumns({ canModerate }: { canModerate: boolean | null }): ColumnDef<ReviewRow, unknown>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" />,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "product",
      header: () => <ColumnHeader title="Product" />,
      cell: ({ row }) => (
        <div className="grid max-w-56 gap-0.5">
          <Link href={`/catalogue/products/${row.original.product.id}/edit`} className="truncate font-medium hover:underline hover:underline-offset-4">
            {row.original.product.name}
          </Link>
          {row.original.variantLabel && <span className="truncate text-xs text-muted-foreground">{row.original.variantLabel}</span>}
        </div>
      ),
    },
    {
      accessorKey: "rating",
      header: () => <ColumnHeader title="Rating" sortKey="rating" />,
      cell: ({ row }) => <Rating rating={row.original.rating} />,
    },
    {
      id: "review",
      header: () => <ColumnHeader title="Review" />,
      cell: ({ row }) => (
        <div className="grid max-w-md min-w-64 gap-0.5 whitespace-normal">
          <span className="font-medium">{row.original.title}</span>
          <span className="line-clamp-2 text-sm text-muted-foreground">{row.original.body}</span>
          {row.original.status === ReviewStatus.HIDDEN && (
            <span className="text-xs text-muted-foreground">
              Hidden{row.original.hiddenByName ? ` by ${row.original.hiddenByName}` : ""}: {row.original.hiddenReason}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "customer",
      header: () => <ColumnHeader title="Customer" />,
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <span>{row.original.customer.name ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{row.original.customer.email}</span>
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: () => <ColumnHeader title="Posted On" sortKey="createdAt" />,
      cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy")}</span>,
    },
    {
      accessorKey: "status",
      header: () => <ColumnHeader title="Status" />,
      cell: ({ row }) => (row.original.status === ReviewStatus.PUBLISHED ? <Badge variant="success">Published</Badge> : <Badge variant="secondary">Hidden</Badge>),
    },
    {
      id: "actions",
      cell: ({ row }) => (canModerate === null ? <Skeleton className="ml-auto h-8 w-16 rounded-md" /> : canModerate ? <ReviewActions review={row.original} /> : null),
    },
  ]
}
