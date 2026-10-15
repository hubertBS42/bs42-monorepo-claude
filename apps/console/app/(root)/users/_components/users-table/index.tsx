"use client"
import { DataTable } from "@workspace/tables"
import { UsersData } from "@/types"
import { columns } from "./columns"
import { filters } from "./filters"
import { useRouter } from "next/navigation"

interface UsersTableProps {
  data: UsersData
}

const UsersTable = ({ data }: UsersTableProps) => {
  const router = useRouter()
  return (
    <DataTable
      columns={columns}
      filters={filters}
      data={data.data}
      onRowClick={(user) => router.push(`/users/${user.id}/edit`)}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default UsersTable
