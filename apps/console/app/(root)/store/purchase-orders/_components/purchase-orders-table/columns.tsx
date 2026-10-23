import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ColumnHeader } from "@workspace/tables"
import { formatDate } from "@workspace/utils/date"
import { PurchaseOrderStatusBadge } from "@/components/order-badges"
import { formatCost } from "@/lib/purchase-order-status"
import type { PurchaseOrderListItem } from "@/types"

// A plain day (yyyy-MM-dd), read as noon UTC so no time zone moves it to another day
const formatDay = (day: string) => formatDate(new Date(`${day}T12:00:00Z`), "MMM d, yyyy")

// With a Store column on the platform's list
export const getColumns = (showStore: boolean): ColumnDef<PurchaseOrderListItem, unknown>[] => [
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
  ...(showStore ? [{ accessorKey: "storeName", header: () => <ColumnHeader title="Store" /> } satisfies ColumnDef<PurchaseOrderListItem, unknown>] : []),
  {
    accessorKey: "supplierName",
    header: () => <ColumnHeader title="Supplier" />,
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" sortKey="status" />,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        <PurchaseOrderStatusBadge status={row.original.status} />
        {row.original.isOverdue && <Badge variant="destructive">Overdue</Badge>}
      </div>
    ),
  },
  {
    id: "received",
    header: () => <ColumnHeader title="Received" />,
    cell: ({ row }) => <span className="tabular-nums">{`${row.original.quantityReceived} of ${row.original.quantityOrdered}`}</span>,
  },
  {
    accessorKey: "total",
    header: () => <ColumnHeader title="Total" />,
    cell: ({ row }) => <span className="tabular-nums">{formatCost(row.original.total, row.original.currency)}</span>,
  },
  {
    accessorKey: "expectedOn",
    header: () => <ColumnHeader title="Expected" sortKey="expectedOn" />,
    cell: ({ row }) =>
      row.original.expectedOn ? (
        <span className={row.original.isOverdue ? "text-destructive" : undefined}>{formatDay(row.original.expectedOn)}</span>
      ) : (
        <span className="text-muted-foreground">
          <span aria-hidden="true">—</span>
          <span className="sr-only">No date</span>
        </span>
      ),
  },
  {
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="Created" sortKey="createdAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy")}</span>,
  },
]
