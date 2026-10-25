"use client"
import { ShoppingCart } from "lucide-react"
import { DataTable } from "@workspace/tables"
import type { OrdersData } from "@/types"
import { columns } from "./columns"
import { getOrderFilters } from "./filters"

interface OrdersTableProps {
  data: OrdersData
  stores: { label: string; value: string }[]
}

const OrdersTable = ({ data, stores }: OrdersTableProps) => {
  return (
    <DataTable
      empty={{ icon: ShoppingCart, title: "No orders yet", description: "Orders from every store show here." }}
      columns={columns}
      filters={getOrderFilters(stores)}
      data={data.data}
      getRowHref={(order) => `/orders/${order.id}/details`}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default OrdersTable
