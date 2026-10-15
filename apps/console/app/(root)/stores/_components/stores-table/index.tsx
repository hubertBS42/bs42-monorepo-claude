"use client"
import { DataTable } from "@workspace/tables"
import type { StoresData } from "@/types"
import { columns } from "./columns"
import { filters } from "./filters"

interface StoresTableProps {
  data: StoresData
}

const StoresTable = ({ data }: StoresTableProps) => {
  return (
    <DataTable
      columns={columns}
      filters={filters}
      data={data.data}
      getRowHref={(store) => `/stores/${store.id}/edit`}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default StoresTable
