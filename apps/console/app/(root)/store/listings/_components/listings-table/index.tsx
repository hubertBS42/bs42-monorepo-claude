"use client"
import { PackageOpen } from "lucide-react"
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
      empty={{ icon: PackageOpen, title: "No listings yet", description: "Products this store sells show here." }}
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
