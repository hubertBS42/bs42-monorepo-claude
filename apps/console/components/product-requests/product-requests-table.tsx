"use client"

import { PackageSearch } from "lucide-react"
import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { ProductRequestStatus } from "@workspace/db/enums"
import { ColumnHeader, DataTable, RowLink, type FilterConfig } from "@workspace/tables"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { toast } from "@workspace/ui/components/toast"
import { formatDate } from "@workspace/utils/date"
import { PRODUCT_REQUEST_STATUS_LABELS, ProductRequestStatusBadge } from "@/components/order-badges"
import { useMemberRole } from "@/hooks/use-member-role"
import { cancelProductRequestAction } from "@/lib/actions/product-request.actions"
import type { ProductRequestListItem, SelectItem } from "@/types"

// A store's requests (storeId), or every store's on the platform's page (stores, for its filter). On the platform's,
// each row opens the request's page; a store's shows what became of each, and "Cancel" while it's pending.

const statusOptions = [{ label: "All statuses", value: "all" }, ...Object.values(ProductRequestStatus).map((status) => ({ label: PRODUCT_REQUEST_STATUS_LABELS[status], value: status }))]

const selectColumn: ColumnDef<ProductRequestListItem, unknown> = {
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
}

const productColumn = (href: ((row: ProductRequestListItem) => string) | null): ColumnDef<ProductRequestListItem, unknown> => ({
  id: "name",
  header: () => <ColumnHeader title="Product" />,
  meta: { rendersRowLink: true },
  cell: ({ row }) => (
    <div className="grid gap-y-0.5">
      {href ? (
        <RowLink href={href(row.original)} className="w-fit">
          {row.original.name}
        </RowLink>
      ) : (
        <span>{row.original.name}</span>
      )}
      {row.original.brand && <span className="text-[11px] text-muted-foreground">{row.original.newBrand ? `${row.original.brand} (new brand)` : row.original.brand}</span>}
    </div>
  ),
})

const statusColumn = (forStore: boolean): ColumnDef<ProductRequestListItem, unknown> => ({
  accessorKey: "status",
  header: () => <ColumnHeader title="Status" />,
  cell: ({ row }) => {
    const { status, product, declineReason } = row.original
    return (
      <div className="grid justify-items-start gap-y-0.5">
        <ProductRequestStatusBadge status={status} />
        {product &&
          (forStore ? (
            <Link href={`/store/products/${product.id}`} className="text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {product.name}
            </Link>
          ) : (
            <Link href={`/catalogue/products/${product.id}/edit`} className="text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {product.name}
            </Link>
          ))}
        {declineReason && <span className="max-w-64 text-[11px] text-muted-foreground">{declineReason}</span>}
      </div>
    )
  },
})

const requestedColumn: ColumnDef<ProductRequestListItem, unknown> = {
  accessorKey: "createdAt",
  header: () => <ColumnHeader title="Requested" />,
  cell: ({ row }) => (
    <div className="grid gap-y-0.5">
      <span>{formatDate(row.original.createdAt, "MMM d, yyyy")}</span>
      {row.original.requestedBy && <span className="text-[11px] text-muted-foreground">{`by ${row.original.requestedBy}`}</span>}
    </div>
  ),
}

const storeColumn: ColumnDef<ProductRequestListItem, unknown> = { accessorKey: "storeName", header: () => <ColumnHeader title="Store" /> }

const requestHref = (row: ProductRequestListItem) => `/catalogue/product-requests/${row.id}`

const platformColumns = [selectColumn, productColumn(requestHref), storeColumn, statusColumn(false), requestedColumn]

function CancelRequest({ storeId, request, canCancel }: { storeId: string; request: ProductRequestListItem; canCancel: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  if (request.status !== ProductRequestStatus.PENDING || !canCancel) return null

  const cancel = () =>
    startTransition(async () => {
      const response = await cancelProductRequestAction({ storeId, requestId: request.id })
      if (!response.success) toast.add({ title: "Couldn't cancel the request", description: response.error, type: "error" })
      else toast.add({ title: "Request cancelled", description: `${request.name} won't be added for you.`, type: "success" })
      router.refresh()
    })

  return (
    <Button type="button" variant="outline" size="xs" disabled={isPending} onClick={cancel}>
      Cancel
    </Button>
  )
}

interface ProductRequestsTableProps {
  data: { data: ProductRequestListItem[]; total: number; page: number; pageSize: number; totalPages: number }
  // A store's list; without it, the platform's
  storeId?: string
  stores?: SelectItem[]
}

export default function ProductRequestsTable({ data, storeId, stores }: ProductRequestsTableProps) {
  // The store's role, fetched once for the table's cells
  const { role } = useMemberRole(storeId ?? null)
  const canCancel = !!storeId && role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { listing: ["create"] } })

  const filters: FilterConfig[] = [
    { key: "status", label: "Status", type: "select", placeholder: "All statuses", options: statusOptions },
    ...(stores
      ? [
          {
            key: "storeId",
            label: "Store",
            type: "select" as const,
            placeholder: "All stores",
            options: [{ label: "All stores", value: "all" }, ...stores.map((store) => ({ label: store.name, value: store.id }))],
          },
        ]
      : []),
  ]

  const columns: ColumnDef<ProductRequestListItem, unknown>[] = storeId
    ? [
        selectColumn,
        productColumn(null),
        statusColumn(true),
        requestedColumn,
        { id: "actions", header: () => null, cell: ({ row }) => <CancelRequest storeId={storeId} request={row.original} canCancel={canCancel} /> },
      ]
    : platformColumns

  return (
    <DataTable
      empty={{
        icon: PackageSearch,
        title: "No product requests yet",
        description: storeId ? "Products you ask the catalogue to add show here." : "Products stores ask the catalogue to add show here.",
      }}
      columns={columns}
      filters={filters}
      data={data.data}
      getRowHref={storeId ? undefined : requestHref}
      pagination={{ total: data.total, page: data.page, pageSize: data.pageSize, totalPages: data.totalPages }}
    />
  )
}
