"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ORG_ROLE_NAMES, type OrgRole } from "@workspace/auth/organization-permissions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { toast } from "@workspace/ui/components/toast"
import { STORE_ROLE_LABELS, StoreRoleBadge } from "@/components/user-badges"
import { updateStoreMemberRoleAction } from "@/lib/actions/member.actions"
import type { StoreMember } from "@/types"

// Owners aren't made from the table, as in the user forms
const roleOptions = ORG_ROLE_NAMES.filter((role) => role !== "owner").map((role) => ({ label: STORE_ROLE_LABELS[role] ?? role, value: role }))

const RoleCell = ({ member, canChange }: { member: StoreMember; canChange: boolean }) => {
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useState(member.role)
  const router = useRouter()
  const displayName = member.user.name ?? member.user.email

  if (!canChange) return <StoreRoleBadge role={member.role} />

  const handleChange = (newRole: OrgRole) => {
    const previousRole = role
    setRole(newRole)

    startTransition(async () => {
      // member.role is what the page loaded, not the select's optimistic value
      const response = await updateStoreMemberRoleAction({ memberId: member.id, storeId: member.organizationId, role: newRole, currentRole: member.role })

      if (!response.success) {
        setRole(previousRole)
        toast.add({ title: "Unable to change the role", description: response.error, type: "error" })
        // The row was stale: show the member's current state
        if (response.code === "ROLE_CHANGED" || response.code === "NOT_FOUND") router.refresh()
        return
      }

      toast.add({ title: "Role updated", description: `${displayName} is now ${STORE_ROLE_LABELS[newRole] ?? newRole}.`, type: "success" })
      router.refresh()
    })
  }

  return (
    <Select
      items={roleOptions}
      value={role}
      onValueChange={(value) => {
        if (value && value !== role) handleChange(value as OrgRole)
      }}
      disabled={isPending}
    >
      <SelectTrigger size="sm" className="w-32" aria-label={`Role of ${displayName}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roleOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default RoleCell
