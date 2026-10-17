import type { FilterConfig } from "@workspace/tables"
import { STORE_ROLE_LABELS } from "@/components/user-badges"
import { inviteSchema } from "@/lib/schemas/invitation.schemas"

export const invitationFilters: FilterConfig[] = [
  { key: "email", label: "Email", type: "text", placeholder: "Search email" },
  {
    key: "role",
    label: "Role",
    type: "select",
    placeholder: "All roles",
    // Only the roles an invitation can carry
    options: [{ label: "All roles", value: "all" }, ...inviteSchema.shape.role.options.map((role) => ({ label: STORE_ROLE_LABELS[role] ?? role, value: role }))],
  },
]
