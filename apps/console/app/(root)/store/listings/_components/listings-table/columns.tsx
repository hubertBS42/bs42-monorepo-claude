/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */
import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { Star } from "lucide-react"
import { formatDate } from "@workspace/utils/date"
import { formatCurrency } from "@workspace/utils/currency"
import { capitalizeWord } from "@workspace/utils/text"
import { Badge } from "@workspace/ui/components/badge"
import { ColumnHeader, RowLink } from "@workspace/tables"
import type { Status } from "@workspace/db/enums"
import type { ListingListItem } from "@/types"
import { Checkbox } from "@workspace/ui/components/checkbox"
import CategoryPath from "@/components/category-path"
import GlobalWorkspaceLink from "@/components/global-workspace-link"

// Archived is a normal end state, not an error, so it's muted rather than red (as on the products table)
const statusBadgeVariants: Record<Status, "outline" | "success" | "secondary"> = {
  DRAFT: "outline",
  PUBLISHED: "success",
  ARCHIVED: "secondary",
}

export const getListingHref = (listing: ListingListItem) => `/store/listings/${listing.id}/edit`

export const columns: ColumnDef<ListingListItem, unknown>[] = [
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
    id: "name",
    header: () => <ColumnHeader title="Product" sortKey="name" />,
    // Only the name is the row's link, as on the products table, so the brand line isn't part of it
    meta: { rendersRowLink: true },
    cell: ({ row }) => {
      const { product } = row.original
      return (
        <div className="flex items-center gap-x-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">{product.image && <img alt="" src={product.image} loading="lazy" className="size-full object-cover" />}</div>
          <div className="grid gap-y-0.5">
            {/* w-fit: a grid stretches links to its width, and clicks beside the text should open the row */}
            <RowLink href={getListingHref(row.original)} className="w-fit">
              {product.name}
            </RowLink>
            {/* The catalogue is global: the brand switches workspace for system admins, and is plain text for store
                staff. The product's details are a store page, for everyone (with a way to the catalogue for admins). */}
            <div className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
              <GlobalWorkspaceLink href={`/catalogue/brands/${product.brandId}/edit`} className="w-fit">
                {product.brandName}
              </GlobalWorkspaceLink>
              <Link href={`/store/products/${product.id}`} className="w-fit underline-offset-4 hover:text-foreground hover:underline">
                Product details
              </Link>
            </div>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "sellPrice",
    header: () => <ColumnHeader title="Price" sortKey="sellPrice" />,
    cell: ({ row }) => {
      const { sellPrice, priceRange } = row.original
      // Variants with their own prices sell at more than one price
      return priceRange ? (
        <span>
          {formatCurrency(priceRange.min)} – {formatCurrency(priceRange.max)}
        </span>
      ) : (
        formatCurrency(sellPrice)
      )
    },
  },
  {
    id: "stock",
    header: () => <ColumnHeader title="Stock" />,
    cell: ({ row }) => {
      const { stock, trackInventory, stockAlert, incoming, product } = row.original
      if (!trackInventory) return <span className="text-muted-foreground">Not tracked</span>

      // A product with variants is judged per variant, as its alert is
      const alertText = !stockAlert
        ? null
        : product.hasVariants
          ? `${stockAlert.count} ${stockAlert.count === 1 ? "variant" : "variants"} ${stockAlert.kind === "out" ? "out of stock" : "low"}`
          : stockAlert.kind === "out"
            ? "Out of stock"
            : "Low"

      return (
        <div className="grid gap-y-0.5">
          <div className="flex items-center gap-2">
            <span>{stock}</span>
            {alertText && <Badge variant={stockAlert?.kind === "out" ? "destructive" : "outline"}>{alertText}</Badge>}
          </div>
          {product.hasVariants && <span className="text-[11px] text-muted-foreground">Across variants on sale</span>}
          {incoming > 0 && <span className="text-[11px] text-muted-foreground">{`${incoming} incoming`}</span>}
        </div>
      )
    },
  },
  {
    id: "category",
    header: () => <ColumnHeader title="Category" />,
    cell: ({ row }) => <CategoryPath path={row.original.product.categoryPath} />,
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" sortKey="status" />,
    cell: ({ row }) => {
      const { status, isFeatured, notOnSaleReason } = row.original
      return (
        <div className="grid gap-y-1">
          <div className="flex flex-wrap gap-1">
            <Badge variant={statusBadgeVariants[status]}>{capitalizeWord(status)}</Badge>
            {notOnSaleReason && <Badge variant="destructive">Not on sale</Badge>}
            {/* Outline with a star, so it doesn't look like Archived's secondary badge */}
            {isFeatured && (
              <Badge variant="outline">
                <Star aria-hidden="true" />
                Featured
              </Badge>
            )}
          </div>
          {notOnSaleReason && <span className="text-[11px] text-muted-foreground">{notOnSaleReason}</span>}
        </div>
      )
    },
  },
  {
    accessorKey: "updatedAt",
    header: () => <ColumnHeader title="Updated" sortKey="updatedAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.updatedAt, "MMM d, yyyy, h:mm a")}</span>,
  },
]
