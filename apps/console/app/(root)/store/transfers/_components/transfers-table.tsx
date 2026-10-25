"use client"

import { ArrowLeftRight } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { StockTransferStatus } from "@workspace/db/enums"
import { ColumnHeader, DataTable, type FilterConfig } from "@workspace/tables"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { formatDate } from "@workspace/utils/date"
import { StockTransferStatusBadge } from "@/components/order-badges"
import { STOCK_TRANSFER_STATUS_LABELS } from "@/lib/stock-transfer-status"
import type { PaginatedResult } from "@workspace/contracts"
import type { StockTransferListItem } from "@/types"

const filters: FilterConfig[] = [
  {
    key: "direction",
    label: "Direction",
    type: "select",
    placeholder: "Sent and received",
    options: [
      { label: "Sent and received", value: "all" },
      { label: "Sent from this store", value: "out" },
      { label: "Sent to this store", value: "in" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    placeholder: "All statuses",
    options: [{ label: "All statuses", value: "all" }, ...Object.values(StockTransferStatus).map((status) => ({ label: STOCK_TRANSFER_STATUS_LABELS[status], value: status }))],
  },
]

const columns: ColumnDef<StockTransferListItem, unknown>[] = [
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
    header: () => <ColumnHeader title="Reference" />,
    cell: ({ row }) => <span className="font-mono">{row.original.reference}</span>,
  },
  {
    id: "store",
    header: () => <ColumnHeader title="Store" />,
    cell: ({ row }) => <span>{row.original.direction === "out" ? `To ${row.original.otherStoreName}` : `From ${row.original.otherStoreName}`}</span>,
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader title="Status" />,
    cell: ({ row }) => <StockTransferStatusBadge status={row.original.status} />,
  },
  {
    id: "items",
    header: () => <ColumnHeader title="Items" />,
    cell: ({ row }) => {
      const { units, lines, unitsReceived } = row.original
      return (
        <div className="grid gap-y-0.5">
          <span className="tabular-nums">{`${units} ${units === 1 ? "unit" : "units"}, ${lines} ${lines === 1 ? "line" : "lines"}`}</span>
          {unitsReceived !== null && unitsReceived < units && <span className="text-[11px] text-muted-foreground">{`${unitsReceived} arrived`}</span>}
        </div>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="Sent" />,
    cell: ({ row }) => (
      <div className="grid gap-y-0.5">
        <span>{formatDate(row.original.createdAt, "MMM d, yyyy")}</span>
        {row.original.sentBy && <span className="text-[11px] text-muted-foreground">{`by ${row.original.sentBy}`}</span>}
      </div>
    ),
  },
]

const transferHref = (row: StockTransferListItem) => `/store/transfers/${row.id}`

export default function TransfersTable({ data }: { data: PaginatedResult<StockTransferListItem> }) {
  return (
    <DataTable
      empty={{ icon: ArrowLeftRight, title: "No transfers yet", description: "Stock sent between this store and others shows here." }}
      columns={columns}
      filters={filters}
      data={data.data}
      getRowHref={transferHref}
      pagination={{ total: data.total, page: data.page, pageSize: data.pageSize, totalPages: data.totalPages }}
    />
  )
}
