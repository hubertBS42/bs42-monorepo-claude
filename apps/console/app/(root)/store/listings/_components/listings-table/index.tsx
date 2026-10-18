"use client"
import { DataTable } from "@workspace/tables"
import type { ListingsData } from "@/types"
import type { ProductFilterOptions } from "@/lib/data/products.data"
import { columns } from "./columns"
import { getListingFilters } from "./filters"

interface ListingsTableProps {
  data: ListingsData
  filterOptions: ProductFilterOptions
}

const ListingsTable = ({ data, filterOptions }: ListingsTableProps) => {
  return (
    <DataTable
      columns={columns}
      filters={getListingFilters(filterOptions)}
      data={data.data}
      getRowHref={(listing) => `/store/listings/${listing.id}/edit`}
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
