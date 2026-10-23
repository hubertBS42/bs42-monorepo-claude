"use client"
import { DataTable } from "@workspace/tables"
import type { QuotesData } from "@/types"
import { columns } from "./columns"
import { filters } from "./filters"

// Rows open the quotation's page; the order cell links to the order
const QuotesTable = ({ data }: { data: QuotesData }) => {
  return (
    <DataTable
      getRowHref={(quote) => `/quotes/${quote.id}`}
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
