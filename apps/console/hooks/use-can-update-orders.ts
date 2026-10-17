"use client"

import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { useMemberRole } from "@/hooks/use-member-role"

/**
 * Whether the current user may change orders: in a store (storeId) by their role there, or on the platform's
 * pages (null) by their system role. The order components are shared by both; the actions check again.
 */
export function useCanUpdateOrders(storeId: string | null) {
  const { role, isLoading: isRoleLoading } = useMemberRole(storeId)
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()

  if (storeId) {
    return { canUpdate: role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { order: ["update"] } }), isLoading: isRoleLoading }
  }
  // hasSystemPermission, not checkRolePermission: roles can be comma-separated
  return { canUpdate: hasSystemPermission(session?.user.role, { order: ["update"] }), isLoading: isSessionLoading }
}
