/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */
import type { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ColumnHeader, RowLink } from "@workspace/tables"
import Link from "next/link"
import { capitalizeWord } from "@workspace/utils/text"
import type { Status } from "@workspace/db/enums"
import type { ProductListItem } from "@/types"
import { formatCurrency } from "@workspace/utils/currency"
import CategoryPath from "@/components/category-path"

// Archived is a normal end state, not an error, so it's muted rather than red
const statusBadgeVariants: Record<Status, "outline" | "success" | "secondary"> = {
  DRAFT: "outline",
  PUBLISHED: "success",
  ARCHIVED: "secondary",
}

const genStatusBadge = (status: Status) => <Badge variant={statusBadgeVariants[status]}>{capitalizeWord(status)}</Badge>

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
    cell: ({ row }) => <CategoryPath path={row.original.categoryPath} />,
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
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" sortKey="status" />,
    cell: ({ row }) => (
      <div className="grid justify-items-start gap-y-0.5">
        {genStatusBadge(row.original.status)}
        {row.original.missing.length > 0 && <span className="text-[11px] text-muted-foreground">{`Missing ${row.original.missing.join(", ")}`}</span>}
      </div>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: () => <ColumnHeader title="Updated" sortKey="updatedAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.updatedAt, "MMM d, yyyy")}</span>,
  },
]
