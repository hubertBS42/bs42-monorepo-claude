"use client"
import { DataTable } from "@workspace/tables"
import type { ListingsData } from "@/types"
import type { ProductFilterOptions } from "@/lib/data/products.data"
import { columns, getListingHref } from "./columns"
import CreatePurchaseOrderButton from "./create-purchase-order-button"
import { getListingFilters } from "./filters"

interface ListingsTableProps {
  storeId: string
  data: ListingsData
  filterOptions: ProductFilterOptions
}

const ListingsTable = ({ storeId, data, filterOptions }: ListingsTableProps) => {
  return (
    <DataTable
      columns={columns}
      filters={getListingFilters(filterOptions)}
      data={data.data}
      getRowHref={getListingHref}
      getRowId={(listing) => listing.id}
      selectionActions={(listings) => <CreatePurchaseOrderButton storeId={storeId} listings={listings} />}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default ListingsTable
