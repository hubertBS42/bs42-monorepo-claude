"use client"
import { useMemo } from "react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { DataTable } from "@workspace/tables"
import { useMemberRole } from "@/hooks/use-member-role"
import type { StoreMembersData } from "@/types"
import { getColumns } from "./columns"
import { memberFilters } from "./filters"

interface MembersTableProps {
  storeId: string
  data: StoreMembersData
}

const MembersTable = ({ storeId, data }: MembersTableProps) => {
  // Once for the table rather than per row. updateStoreMemberRoleAction checks again on the server.
  const { role, isLoading: isRoleLoading } = useMemberRole(storeId)
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()

  const isLoading = isRoleLoading || isSessionLoading
  const canUpdateRoles = isLoading ? null : role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { member: ["update"] } })
  const viewerUserId = session?.user.id ?? null

  const columns = useMemo(() => getColumns({ viewerUserId, canUpdateRoles }), [viewerUserId, canUpdateRoles])

  return (
    <div className="grid gap-2">
      {/* Shown as text: the role selects aren't offered at all, so say why */}
      {canUpdateRoles === false && <p className="text-sm text-muted-foreground">Your role in this store can&apos;t change members&apos; roles.</p>}
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
    </div>
  )
}

export default MembersTable
