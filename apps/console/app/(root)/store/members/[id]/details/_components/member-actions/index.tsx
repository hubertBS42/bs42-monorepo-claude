"use client"

import { consoleAuthClient } from "@workspace/auth/console-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMemberRole } from "@/hooks/use-member-role"
import RemoveMember, { type RemovableMember } from "./remove-member"

interface MemberActionsProps {
  storeId: string
  member: RemovableMember & { userId: string; role: string }
}

// Checks the viewer's store role itself, like the other action buttons; removeStoreMemberAction checks again
const MemberActions = ({ storeId, member }: MemberActionsProps) => {
  const { role, isLoading: isRoleLoading } = useMemberRole(storeId)
  const { data: session, isPending: isSessionLoading } = consoleAuthClient.useSession()

  const body = (() => {
    if (isRoleLoading || isSessionLoading) return <Skeleton className="h-9 rounded-md" />

    // Mirrors Better Auth's removeMember: it needs member:delete, and only owners can remove an owner
    const canRemoveMembers = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { member: ["delete"] } })
    const disabledReason =
      member.userId === session?.user.id
        ? "You can't remove yourself. Leave the store from its overview page instead."
        : !canRemoveMembers
          ? "Your role in this store can't remove members."
          : member.role === "owner" && role !== "owner"
            ? "Only an owner can remove another owner."
            : null

    return <RemoveMember member={member} disabledReason={disabledReason} />
  })()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>Remove this member from the store.</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
export default MemberActions
