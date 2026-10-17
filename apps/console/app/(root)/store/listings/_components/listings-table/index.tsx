"use client"
import { DataTable } from "@workspace/tables"
import type { ListingsData } from "@/types"
import { columns } from "./columns"
import { listingFilters } from "./filters"

const ListingsTable = ({ data }: { data: ListingsData }) => {
  return (
    <DataTable
      columns={columns}
      filters={listingFilters}
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
