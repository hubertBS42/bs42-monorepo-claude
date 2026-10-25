"use client"
import { Users } from "lucide-react"
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
      empty={{ icon: Users, title: "No users yet", description: "Staff and customers show here." }}
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
