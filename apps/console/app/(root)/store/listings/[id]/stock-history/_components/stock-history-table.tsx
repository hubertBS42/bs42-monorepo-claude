"use client"
import { History } from "lucide-react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { ColumnHeader, DataTable, type FilterConfig } from "@workspace/tables"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { formatDate } from "@workspace/utils/date"
import { STOCK_MOVEMENT_REASON_LABELS } from "@/lib/stock-reasons"
import type { PaginatedResult } from "@workspace/contracts"
import type { SelectItem, StockMovementItem } from "@/types"

const empty = (label: string) => (
  <span className="text-muted-foreground">
    <span aria-hidden="true">—</span>
    <span className="sr-only">{label}</span>
  </span>
)

const columns: ColumnDef<StockMovementItem, unknown>[] = [
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
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="When" />,
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.createdAt, "MMM d, yyyy, h:mm a")}</span>,
  },
  {
    accessorKey: "variantDescription",
    header: () => <ColumnHeader title="Variant" />,
  },
  {
    accessorKey: "change",
    header: () => <ColumnHeader title="Change" />,
    cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.change > 0 ? `+${row.original.change}` : row.original.change}</span>,
  },
  {
    accessorKey: "stockAfter",
    header: () => <ColumnHeader title="Stock after" />,
    cell: ({ row }) => <span className="tabular-nums">{row.original.stockAfter}</span>,
  },
  {
    accessorKey: "reason",
    header: () => <ColumnHeader title="Reason" />,
    cell: ({ row }) => (
      <div className="grid gap-0.5 whitespace-normal">
        <span>{STOCK_MOVEMENT_REASON_LABELS[row.original.reason]}</span>
        {row.original.note && <span className="text-xs text-muted-foreground">{row.original.note}</span>}
      </div>
    ),
  },
  {
    id: "source",
    header: () => <ColumnHeader title="From" />,
    cell: ({ row }) =>
      row.original.source ? (
        <Link href={row.original.source.href} className="font-mono underline-offset-4 hover:underline">
          {row.original.source.label}
        </Link>
      ) : (
        empty("Nothing linked")
      ),
  },
  {
    accessorKey: "createdBy",
    header: () => <ColumnHeader title="By" />,
    cell: ({ row }) => row.original.createdBy ?? empty("Unknown"),
  },
]

interface StockHistoryTableProps {
  data: PaginatedResult<StockMovementItem>
  // The listing's variants, for a product with variants; null without
  variants: SelectItem[] | null
}

const StockHistoryTable = ({ data, variants }: StockHistoryTableProps) => {
  const filters: FilterConfig[] = [
    {
      key: "reason",
      label: "Reason",
      type: "select",
      placeholder: "All reasons",
      options: [{ label: "All reasons", value: "all" }, ...Object.entries(STOCK_MOVEMENT_REASON_LABELS).map(([value, label]) => ({ label, value }))],
    },
    ...(variants
      ? [
          {
            key: "variantId",
            label: "Variant",
            type: "select" as const,
            placeholder: "All variants",
            options: [{ label: "All variants", value: "all" }, ...variants.map((variant) => ({ label: variant.name, value: variant.id }))],
          },
        ]
      : []),
  ]

  return (
    <DataTable
      empty={{ icon: History, title: "No stock changes yet", description: "Every change to this listing's stock shows here." }}
      // The Variant column only means something for a product with variants
      columns={variants ? columns : columns.filter((column) => !("accessorKey" in column) || column.accessorKey !== "variantDescription")}
      filters={filters}
      data={data.data}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default StockHistoryTable
