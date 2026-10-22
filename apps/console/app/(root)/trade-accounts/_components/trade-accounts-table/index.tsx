"use client"
import { DataTable } from "@workspace/tables"
import type { TradeAccountsData } from "@/types"
import { columns } from "./columns"
import { filters } from "./filters"

const TradeAccountsTable = ({ data }: { data: TradeAccountsData }) => {
  return (
    <DataTable
      columns={columns}
      filters={filters}
      data={data.data}
      getRowHref={(account) => `/trade-accounts/${account.id}`}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default TradeAccountsTable
