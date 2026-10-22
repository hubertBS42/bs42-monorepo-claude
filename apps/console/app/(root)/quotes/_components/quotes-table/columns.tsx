import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { ExternalLink } from "lucide-react"
import { ColumnHeader } from "@workspace/tables"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import type { QuoteRow, QuoteStatusFilter } from "@/types"

// Like orders: accepted is done, expired and cancelled are muted, open is still in play
const STATUS: Record<QuoteStatusFilter, { label: string; variant: "outline" | "secondary" | "success" }> = {
  open: { label: "Open", variant: "outline" },
  expired: { label: "Expired", variant: "secondary" },
  accepted: { label: "Accepted", variant: "success" },
  cancelled: { label: "Cancelled", variant: "secondary" },
}

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
    cell: ({ row }) => (
      <a href={row.original.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:underline hover:underline-offset-4">
        {row.original.reference}
        <ExternalLink className="size-3 text-muted-foreground" aria-label="(opens the storefront's quotation)" />
      </a>
    ),
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
    cell: ({ row }) => <Badge variant={STATUS[row.original.status].variant}>{STATUS[row.original.status].label}</Badge>,
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
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="Made On" sortKey="createdAt" />,
    cell: ({ row }) => formatDate(row.original.createdAt, "MMM d, yyyy"),
  },
]
