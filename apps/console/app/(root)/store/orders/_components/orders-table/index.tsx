"use client"
import { ShoppingCart } from "lucide-react"
import { DataTable } from "@workspace/tables"
import type { StoreOrdersData } from "@/types"
import { columns } from "./columns"
import { orderFilters } from "./filters"

const OrdersTable = ({ data }: { data: StoreOrdersData }) => {
  return (
    <DataTable
      empty={{ icon: ShoppingCart, title: "No orders yet", description: "This store's orders show here." }}
      columns={columns}
      filters={orderFilters}
      data={data.data}
      getRowHref={(order) => `/store/orders/${order.id}/details`}
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
