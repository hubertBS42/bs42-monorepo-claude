"use client"
import { useMemo } from "react"
import { FileText } from "lucide-react"
import { DataTable } from "@workspace/tables"
import type { QuotesData } from "@/types"
import { quoteColumns } from "./columns"
import { filters } from "./filters"

// Rows open the quotation's page; the order cell links to the order. A store's quotations are all made by its staff, so
// its table has no "Made by" filter.
const QuotesTable = ({ data, storeId }: { data: QuotesData; storeId: string | null }) => {
  const columns = useMemo(() => quoteColumns(storeId), [storeId])
  return (
    <DataTable
      empty={{ icon: FileText, title: "No quotations yet", description: storeId ? "Quotations this store makes show here." : "Quotations customers ask for, or staff make, show here." }}
      getRowHref={(quote) => `${storeId ? "/store" : ""}/quotes/${quote.id}`}
      columns={columns}
      filters={storeId ? filters.filter((filter) => filter.key !== "madeBy") : filters}
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
