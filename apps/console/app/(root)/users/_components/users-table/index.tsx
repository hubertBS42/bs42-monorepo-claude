"use client"
import { DataTable } from "@workspace/tables"
import type { UsersData } from "@/types"
import { columns } from "./columns"
import { getUserFilters } from "./filters"

interface UsersTableProps {
  data: UsersData
  canSeeSuperAdmins: boolean
}

const UsersTable = ({ data, canSeeSuperAdmins }: UsersTableProps) => {
  return (
    <DataTable
      columns={columns}
      filters={getUserFilters({ canSeeSuperAdmins })}
      data={data.data}
      getRowHref={(user) => `/users/${user.id}/edit`}
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
