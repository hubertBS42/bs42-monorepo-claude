"use client"
import { DataTable } from "@workspace/tables"
import type { StoreMembersData } from "@/types"
import { getColumns } from "./columns"
import { memberFilters } from "./filters"

interface MembersTableProps {
  data: StoreMembersData
  viewerUserId: string
  canUpdateRoles: boolean
}

const MembersTable = ({ data, viewerUserId, canUpdateRoles }: MembersTableProps) => {
  return (
    <DataTable
      columns={getColumns({ viewerUserId, canUpdateRoles })}
      filters={memberFilters}
      data={data.data}
      getRowHref={(member) => `/store/members/${member.id}/details`}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default MembersTable
