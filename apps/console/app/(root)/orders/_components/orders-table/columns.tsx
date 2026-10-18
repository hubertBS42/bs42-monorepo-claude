import type { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"
import { formatCurrency } from "@workspace/utils/currency"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ColumnHeader } from "@workspace/tables"
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-badges"
import type { OrderListItem } from "@/types"

export const columns: ColumnDef<OrderListItem, unknown>[] = [
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
    accessorKey: "storeNames",
    header: () => <ColumnHeader title="Stores" />,
    cell: ({ row }) => {
      const { storeNames } = row.original
      return storeNames.length > 1 ? (
        <div className="grid gap-y-0.5">
          <span>{`${storeNames.length} stores`}</span>
          <span className="max-w-48 truncate text-[11px] text-muted-foreground" title={storeNames.join(", ")}>
            {storeNames.join(", ")}
          </span>
        </div>
      ) : (
        <span>{storeNames[0]}</span>
      )
    },
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" sortKey="status" />,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        <OrderStatusBadge status={row.original.status} />
        {row.original.returned && <Badge variant="secondary">{row.original.returned}</Badge>}
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
    header: () => <ColumnHeader title="Total" sortKey="totalGhs" />,
    cell: ({ row }) => <span>{formatCurrency(row.original.totalGhs, "GHS", "en-GH")}</span>,
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
