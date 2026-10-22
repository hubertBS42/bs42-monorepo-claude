import type { ColumnDef } from "@tanstack/react-table"
import { ColumnHeader } from "@workspace/tables"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { formatDate } from "@workspace/utils/date"
import { BUSINESS_TYPE_LABELS } from "@workspace/commerce/trade-account-status"
import { TradeAccountStatusBadge } from "@/components/order-badges"
import type { TradeAccountRow } from "@/types"

export const columns: ColumnDef<TradeAccountRow, unknown>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    // stopPropagation: ticking the box mustn't open the row
    cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} onClick={(e) => e.stopPropagation()} aria-label="Select row" />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "companyName",
    header: () => <ColumnHeader title="Company" sortKey="companyName" />,
    cell: ({ row }) => (
      <div className="grid gap-0.5">
        <span className="font-medium">{row.original.companyName}</span>
        <span className="text-xs text-muted-foreground">{BUSINESS_TYPE_LABELS[row.original.businessType]}</span>
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
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" />,
    cell: ({ row }) => <TradeAccountStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "discountPercent",
    header: () => <ColumnHeader title="Discount" />,
    cell: ({ row }) => (row.original.discountPercent ? `${Number(row.original.discountPercent)}%` : <span className="text-muted-foreground">—</span>),
  },
  {
    accessorKey: "orderCount",
    header: () => <ColumnHeader title="Orders" />,
    cell: ({ row }) => row.original.orderCount,
  },
  {
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="Applied On" sortKey="createdAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy")}</span>,
  },
]
