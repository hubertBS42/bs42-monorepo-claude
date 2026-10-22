"use client"
import { DataTable } from "@workspace/tables"
import type { QuotesData } from "@/types"
import { columns } from "./columns"
import { filters } from "./filters"

// No row links: the reference opens the storefront's quotation, and the order cell the order
const QuotesTable = ({ data }: { data: QuotesData }) => {
  return (
    <DataTable
      columns={columns}
      filters={filters}
      data={data.data}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default QuotesTable
