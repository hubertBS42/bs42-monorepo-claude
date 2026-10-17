"use client"

import { consoleAuthClient } from "@workspace/auth/console-client"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import DeleteStore from "@/components/delete-store"
import { useMemberRole } from "@/hooks/use-member-role"
import type { Store } from "@/types"
import LeaveStore from "./leave-store"

// Platform staff are added to every store automatically, so they don't leave stores; they see Delete, which
// explains itself when their store role can't delete. Store staff can leave, and owners can also delete their store.
// Decided here from the session and store role, like the other action buttons; the actions check again.
const StoreActions = ({ store }: { store: Store }) => {
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()
  const { role, isLoading: isRoleLoading } = useMemberRole(store.id)

  if (isSessionLoading || isRoleLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 rounded-md" />
        </CardContent>
      </Card>
    )
  }

  // hasSystemRole, not ===: role strings can be comma-separated
  const isPlatformStaff = hasSystemRole(session?.user.role, consoleAdminRoles)
  const canDelete = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { organization: ["delete"] } })
  const showDelete = isPlatformStaff || canDelete
  const showLeave = !isPlatformStaff

  const description = showDelete && showLeave ? "Leave this store, or permanently delete it and all its data." : showDelete ? "Permanently delete this store and all its data." : "Leave this store."

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-y-2">
        {showLeave && <LeaveStore store={store} />}
        {showDelete && <DeleteStore store={store} />}
      </CardContent>
    </Card>
  )
}
export default StoreActions
