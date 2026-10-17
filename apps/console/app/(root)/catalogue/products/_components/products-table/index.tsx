"use client"
import { DataTable } from "@workspace/tables"
import type { ProductsData } from "@/types"
import { columns, getProductHref } from "./columns"
import { filters } from "./filters"

interface ProductsTableProps {
  data: ProductsData
}

const ProductsTable = ({ data }: ProductsTableProps) => {
  return (
    <DataTable
      columns={columns}
      filters={filters}
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
