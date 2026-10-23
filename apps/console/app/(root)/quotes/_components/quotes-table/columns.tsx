import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { ColumnHeader } from "@workspace/tables"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import { QUOTE_STATUS } from "@/components/quote-status"
import type { QuoteRow } from "@/types"

export const columns: ColumnDef<QuoteRow, unknown>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} onClick={(e) => e.stopPropagation()} aria-label="Select row" />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "reference",
    header: () => <ColumnHeader title="Reference" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.reference}</span>,
  },
  {
    id: "customer",
    header: () => <ColumnHeader title="Customer" />,
    cell: ({ row }) => (
      <div className="grid gap-0.5">
        <span>{row.original.customer.name}</span>
        <span className="text-xs text-muted-foreground">{row.original.customer.email}</span>
        {row.original.tradeCompanyName && <span className="text-xs text-muted-foreground">{`Trade: ${row.original.tradeCompanyName}`}</span>}
      </div>
    ),
  },
  {
    accessorKey: "lineCount",
    header: () => <ColumnHeader title="Lines" />,
  },
  {
    accessorKey: "totalGhs",
    header: () => <ColumnHeader title="Total" sortKey="totalGhs" />,
    cell: ({ row }) => formatCurrency(row.original.totalGhs, "GHS", "en-GH"),
  },
  {
    accessorKey: "validUntil",
    header: () => <ColumnHeader title="Valid Until" sortKey="validUntil" />,
    cell: ({ row }) => formatDate(row.original.validUntil, "MMM d, yyyy"),
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" />,
    cell: ({ row }) => <Badge variant={QUOTE_STATUS[row.original.status].variant}>{QUOTE_STATUS[row.original.status].label}</Badge>,
  },
  {
    id: "order",
    header: () => <ColumnHeader title="Order" />,
    cell: ({ row }) =>
      row.original.order ? (
        <Link href={`/orders/${row.original.order.id}/details`} className="font-mono text-xs hover:underline hover:underline-offset-4">
          {row.original.order.reference}
        </Link>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "createdBy",
    header: () => <ColumnHeader title="Made By" />,
    cell: ({ row }) => row.original.createdBy ?? <span className="text-muted-foreground">Customer</span>,
  },
  {
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="Made On" sortKey="createdAt" />,
    cell: ({ row }) => formatDate(row.original.createdAt, "MMM d, yyyy"),
  },
]
