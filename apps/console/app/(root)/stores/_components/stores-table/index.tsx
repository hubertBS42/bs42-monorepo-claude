"use client"
import { DataTable } from "@workspace/tables"
import { StoresData } from "@/types"
import { columns } from "./columns"
import { useRouter } from "next/navigation"
import { filters } from "./filters"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"

interface StoresTableProps {
  data: StoresData
}

const StoresTable = ({ data }: StoresTableProps) => {
  const router = useRouter()
  const stores = data.data
  const filteredStores = stores.filter((store) => store.slug !== PLATFORM_ORGANIZATION_SLUG)
  return (
    <DataTable
      columns={columns}
      filters={filters}
      data={filteredStores}
      onRowClick={(store) => router.push(`/stores/${store.id}/edit`)}
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
