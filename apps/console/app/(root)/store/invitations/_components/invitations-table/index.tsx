"use client"
import { DataTable } from "@workspace/tables"
import type { InvitationsData } from "@/types"
import { getColumns } from "./columns"
import { invitationFilters } from "./filters"

interface InvitationsTableProps {
  data: InvitationsData
  canResend: boolean
  canCancel: boolean
}

// No row links: an invitation has no page of its own, and the table shows all of it
const InvitationsTable = ({ data, canResend, canCancel }: InvitationsTableProps) => {
  return (
    <DataTable
      columns={getColumns({ canResend, canCancel })}
      filters={invitationFilters}
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

export default InvitationsTable
