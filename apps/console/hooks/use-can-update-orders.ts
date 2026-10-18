"use client"

import { consoleAuthClient } from "@workspace/auth/console-client"
import { consoleAdminRoles, hasSystemPermission, hasSystemRole } from "@workspace/auth/system-permissions"
import { useMemberRole } from "@/hooks/use-member-role"

/**
 * Whether the current user may change orders (update), or give refunds and record returns (refund): in a store
 * (storeId) by their role there, or on the platform's pages (null) by their system role. System admins are members
 * of every store but refund by their system role everywhere (admins can't); bySystemRole says which applied. The
 * order components are shared by both; the actions check again.
 */
export function useCanUpdateOrders(storeId: string | null, permission: "update" | "refund" = "update") {
  const { role, isLoading: isRoleLoading } = useMemberRole(storeId)
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()

  const bySystemRole = !storeId || (permission === "refund" && hasSystemRole(session?.user.role, consoleAdminRoles))
  if (!bySystemRole) {
    // A refund waits for the session too, which decides whether the store role counts
    const isLoading = isRoleLoading || (permission === "refund" && isSessionLoading)
    return { canUpdate: role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { order: [permission] } }), isLoading, bySystemRole }
  }
  // hasSystemPermission, not checkRolePermission: roles can be comma-separated
  return { canUpdate: hasSystemPermission(session?.user.role, { order: [permission] }), isLoading: isSessionLoading, bySystemRole }
}
