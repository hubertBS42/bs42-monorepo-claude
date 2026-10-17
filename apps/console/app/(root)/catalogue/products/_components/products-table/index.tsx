"use client"
import { DataTable } from "@workspace/tables"
import type { ProductsData } from "@/types"
import { columns, getProductHref } from "./columns"
import { getProductFilters } from "./filters"
import type { ProductFilterOptions } from "@/lib/data/products.data"

interface ProductsTableProps {
  data: ProductsData
  filterOptions: ProductFilterOptions
}

const ProductsTable = ({ data, filterOptions }: ProductsTableProps) => {
  return (
    <DataTable
      columns={columns}
      filters={getProductFilters(filterOptions)}
      data={data.data}
      getRowHref={getProductHref}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default ProductsTable
