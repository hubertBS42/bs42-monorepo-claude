"use client"
import { DataTable } from "@workspace/tables"
import type { BrandsData } from "@/types"
import { columns } from "./columns"
import { filters } from "./filters"

interface BrandsTableProps {
  data: BrandsData
}

const BrandsTable = ({ data }: BrandsTableProps) => {
  return (
    <DataTable
      columns={columns}
      filters={filters}
      data={data.data}
      getRowHref={(brand) => `/catalogue/brands/${brand.id}/edit`}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default BrandsTable
