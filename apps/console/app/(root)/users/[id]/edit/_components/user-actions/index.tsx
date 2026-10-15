"use client"

import { consoleAuthClient } from "@workspace/auth/console-client"
import ChangePassword from "./change-password"
import ResetPassword from "./reset-password"
import UnbanUser from "./unban-user"
import BanUser from "./ban-user"
import DeleteUser from "./delete-user"
import ChangeSystemRole from "./change-system-role"
import { canManageUserWithRole, hasSystemPermission, hasSystemRole } from "@workspace/auth/system-permissions"
import type { User } from "@workspace/db/client"
import { Skeleton } from "@workspace/ui/components/skeleton"

const UserActions = ({ user }: { user: User }) => {
  const { data, isPending: sessionIsLoading } = consoleAuthClient.useSession()

  if (sessionIsLoading) {
    return (
      <div className="grid gap-y-2">
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
      </div>
    )
  }

  if (!data) return null

  const viewerRole = data.user.role
  const isCurrentUser = user.id === data.user.id
  // Mirrors the server: only superAdmins can act on superAdmins
  const canManage = !isCurrentUser && canManageUserWithRole(viewerRole, user.role)

  const canResetPassword = canManage && hasSystemPermission(viewerRole, { user: ["update"] })
  const canBan = canManage && hasSystemPermission(viewerRole, { user: ["ban"] })
  const canDelete = canManage && hasSystemPermission(viewerRole, { user: ["delete"] })
  // Only superAdmins have set-role. Store staff must be made admins before they can be promoted.
  const canChangeRole = canManage && hasSystemPermission(viewerRole, { user: ["set-role"] })
  const targetIsSuperAdmin = hasSystemRole(user.role, ["superAdmin"])
  const canPromote = canChangeRole && !targetIsSuperAdmin && hasSystemRole(user.role, ["admin"]) && !user.banned
  const canDemote = canChangeRole && targetIsSuperAdmin

  return (
    <div className="grid gap-y-2">
      {isCurrentUser && <ChangePassword />}
      {canResetPassword && <ResetPassword user={user} />}
      {canPromote && <ChangeSystemRole user={user} change="promote" />}
      {canDemote && <ChangeSystemRole user={user} change="demote" />}
      {canBan && (user.banned ? <UnbanUser user={user} /> : <BanUser user={user} />)}
      {canDelete && <DeleteUser user={user} />}
    </div>
  )
}
export default UserActions
