"use client"
import { Mail } from "lucide-react"
import { useMemo } from "react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { DataTable } from "@workspace/tables"
import { useMemberRole } from "@/hooks/use-member-role"
import type { InvitationsData } from "@/types"
import { getColumns } from "./columns"
import { invitationFilters } from "./filters"

interface InvitationsTableProps {
  storeId: string
  data: InvitationsData
}

// No row links: an invitation has no page of its own, and the table shows all of it
const InvitationsTable = ({ storeId, data }: InvitationsTableProps) => {
  // Once for the table rather than per row; the actions check again, through Better Auth. Null while loading.
  const { role, isLoading } = useMemberRole(storeId)
  const can = (action: "create" | "cancel") => (isLoading ? null : role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { invitation: [action] } }))
  const canResend = can("create")
  const canCancel = can("cancel")

  const columns = useMemo(() => getColumns({ canResend, canCancel }), [canResend, canCancel])

  return (
    <div className="grid gap-2">
      {/* Shown as text: the row actions aren't offered at all, so say why */}
      {canResend === false && canCancel === false && <p className="text-sm text-muted-foreground">Your role in this store can&apos;t resend or cancel invitations.</p>}
      <DataTable
        empty={{ icon: Mail, title: "No invitations yet", description: "Invitations you send to join this store show here." }}
        columns={columns}
        filters={invitationFilters}
        data={data.data}
        pagination={{
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          totalPages: data.totalPages,
        }}
      />
    </div>
  )
}

export default InvitationsTable
