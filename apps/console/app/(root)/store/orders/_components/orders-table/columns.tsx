import type { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"
import { formatCurrency } from "@workspace/utils/currency"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ColumnHeader } from "@workspace/tables"
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-badges"
import type { StoreOrderListItem } from "@/types"

export const columns: ColumnDef<StoreOrderListItem, unknown>[] = [
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
    accessorKey: "reference",
    header: () => <ColumnHeader title="Reference" sortKey="reference" />,
    cell: ({ row }) => <span className="font-mono">{row.original.reference}</span>,
  },
  {
    accessorKey: "customerName",
    header: () => <ColumnHeader title="Customer" />,
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" sortKey="status" />,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        <OrderStatusBadge status={row.original.status} />
        {row.original.isMultiStore && <Badge variant="outline">With other stores</Badge>}
      </div>
    ),
  },
  {
    accessorKey: "paymentStatus",
    header: () => <ColumnHeader title="Payment" />,
    cell: ({ row }) => <PaymentStatusBadge status={row.original.paymentStatus} />,
  },
  {
    accessorKey: "totalGhs",
    header: () => <ColumnHeader title="Total" />,
    cell: ({ row }) => (
      <div className="grid gap-y-0.5">
        <span>{formatCurrency(row.original.totalGhs, "GHS", "en-GH")}</span>
        {/* Shipping and other stores' items aren't this store's */}
        {row.original.isMultiStore && <span className="text-[11px] text-muted-foreground">This store&apos;s items</span>}
      </div>
    ),
  },
  {
    accessorKey: "itemCount",
    header: () => <ColumnHeader title="Items" />,
  },
  {
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="Placed" sortKey="createdAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy, h:mm a")}</span>,
  },
]
