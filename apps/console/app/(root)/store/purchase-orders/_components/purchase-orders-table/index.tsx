"use client"
import { DataTable } from "@workspace/tables"
import type { PurchaseOrdersData, SelectItem } from "@/types"
import { getColumns } from "./columns"
import { purchaseOrderFilters } from "./filters"

// A store's purchase orders (with suppliers to filter by), or the platform's read-only view of every store's (stores)
const storeColumns = getColumns(false)
const platformColumns = getColumns(true)

type PurchaseOrdersTableProps = { data: PurchaseOrdersData } & ({ suppliers: SelectItem[]; stores?: never } | { stores: SelectItem[]; suppliers?: never })

const PurchaseOrdersTable = ({ data, suppliers, stores }: PurchaseOrdersTableProps) => {
  return (
    <DataTable
      columns={stores ? platformColumns : storeColumns}
      filters={purchaseOrderFilters({ suppliers, stores })}
      data={data.data}
      getRowHref={(order) => (stores ? `/purchase-orders/${order.id}/details` : `/store/purchase-orders/${order.id}/details`)}
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
