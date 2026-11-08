"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { PackageCheck } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { ColumnHeader, DataTable, type FilterConfig } from "@workspace/tables"
import { formatDate } from "@workspace/utils/date"
import { PaymentStatusBadge } from "@/components/order-badges"
import type { CollectionListItem } from "@/types"
import type { PaginatedResult } from "@workspace/contracts"
import { STATE_LABELS } from "../../states"

const columns: ColumnDef<CollectionListItem, unknown>[] = [
  { accessorKey: "reference", header: () => <ColumnHeader title="Reference" />, cell: ({ row }) => <span className="font-mono">{row.original.reference}</span> },
  { accessorKey: "customerName", header: () => <ColumnHeader title="Customer" /> },
  {
    accessorKey: "state",
    header: () => <ColumnHeader title="Collection" />,
    cell: ({ row }) => <Badge variant={row.original.state === "ready" ? "success" : row.original.state === "coming" ? "outline" : "secondary"}>{STATE_LABELS[row.original.state]}</Badge>,
  },
  { accessorKey: "paymentStatus", header: () => <ColumnHeader title="Payment" />, cell: ({ row }) => <PaymentStatusBadge status={row.original.paymentStatus} /> },
  { accessorKey: "itemCount", header: () => <ColumnHeader title="Items" /> },
  { accessorKey: "createdAt", header: () => <ColumnHeader title="Placed" />, cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy, h:mm a")}</span> },
]

const filters: FilterConfig[] = [
  {
    key: "view",
    label: "Show",
    type: "select",
    placeholder: "To hand over",
    options: [
      { label: "To hand over", value: "all" },
      { label: "Collected", value: "collected" },
    ],
  },
]

export default function CollectionsTable({ data }: { data: PaginatedResult<CollectionListItem> }) {
  return (
    <DataTable
      empty={{ icon: PackageCheck, title: "Nothing to collect here", description: "Orders customers collect at this branch show here." }}
      columns={columns}
      filters={filters}
      data={data.data}
      getRowHref={(order) => `/store/collections/${order.id}`}
      pagination={{ total: data.total, page: data.page, pageSize: data.pageSize, totalPages: data.totalPages }}
    />
  )
}
