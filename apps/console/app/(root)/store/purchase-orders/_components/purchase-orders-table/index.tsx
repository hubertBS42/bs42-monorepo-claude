"use client"
import { DataTable } from "@workspace/tables"
import type { PurchaseOrdersData, SelectItem } from "@/types"
import { columns } from "./columns"
import { purchaseOrderFilters } from "./filters"

const PurchaseOrdersTable = ({ data, suppliers }: { data: PurchaseOrdersData; suppliers: SelectItem[] }) => {
  return (
    <DataTable
      columns={columns}
      filters={purchaseOrderFilters(suppliers)}
      data={data.data}
      getRowHref={(order) => `/store/purchase-orders/${order.id}/details`}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default PurchaseOrdersTable
