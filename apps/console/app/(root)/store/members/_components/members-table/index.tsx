"use client"
import { useMemo } from "react"
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
  const columns = useMemo(() => getColumns({ viewerUserId, canUpdateRoles }), [viewerUserId, canUpdateRoles])

  return (
    <DataTable
      columns={columns}
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
