/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */
import type { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ColumnHeader, RowLink } from "@workspace/tables"
import Link from "next/link"
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

// A dash for an empty value, with the meaning spelt out for screen readers
const emptyCell = (label: string) => (
  <span className="text-muted-foreground">
    <span aria-hidden="true">—</span>
    <span className="sr-only">{label}</span>
  </span>
)

export const getProductHref = (product: ProductListItem) => `/catalogue/products/${product.id}/edit`

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
    // The brand line links to the brand, so this cell renders the product link itself
    meta: { rendersRowLink: true },
    cell: ({ row }) => {
      const product = row.original
      const image = product.images[0]
      return (
        <div className="flex items-center gap-x-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">{image && <img alt="" src={image} loading="lazy" className="size-full object-cover" />}</div>
          <div className="grid gap-y-0.5">
            {/* w-fit: a grid stretches links to its width, and clicks beside the text should open the row, not either link */}
            <RowLink href={getProductHref(product)} className="w-fit">
              {product.name}
            </RowLink>
            <Link href={`/catalogue/brands/${product.brand.id}/edit`} className="w-fit text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {product.brand.name}
            </Link>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "baseSellPrice",
    // Stores set their own prices per listing, so this is the starting point rather than what customers pay
    header: () => <ColumnHeader title="Base Price" sortKey="baseSellPrice" />,
    cell: ({ row }) => (
      <div className="grid gap-y-0.5">
        <span>{formatCurrency(row.original.baseSellPrice)}</span>
        <span className="text-[11px] text-muted-foreground">Buy {formatCurrency(row.original.baseBuyPrice)}</span>
      </div>
    ),
  },
  {
    accessorKey: "categoryPath",
    header: () => <ColumnHeader title="Category" />,
    cell: ({ row }) => {
      const segments = row.original.categoryPath.split(" / ")
      const leaf = segments.pop()
      return (
        <span className="text-sm">
          {segments.length > 0 && <span className="text-muted-foreground">{segments.join(" / ")} / </span>}
          {leaf}
        </span>
      )
    },
  },
  {
    accessorKey: "variantCount",
    header: () => <ColumnHeader title="Variants" />,
    cell: ({ row }) => {
      const count = row.original.variantCount
      return count > 0 ? <span>{count === 1 ? "1 variant" : `${count} variants`}</span> : emptyCell("No variants")
    },
  },
  {
    accessorKey: "storeCount",
    // How many stores sell it, which is also how many lose it if it's archived
    header: () => <ColumnHeader title="Stores" />,
    cell: ({ row }) => (row.original.storeCount > 0 ? <span>{row.original.storeCount}</span> : emptyCell("Not listed in any store")),
  },
  {
    accessorKey: "condition",
    header: () => <ColumnHeader title="Condition" sortKey="condition" />,
    cell: ({ row }) => genConditionBadge(row.original.condition),
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" sortKey="status" />,
    cell: ({ row }) => genStatusBadge(row.original.status),
  },
  {
    accessorKey: "updatedAt",
    header: () => <ColumnHeader title="Updated" sortKey="updatedAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.updatedAt, "MMM d, yyyy")}</span>,
  },
]
