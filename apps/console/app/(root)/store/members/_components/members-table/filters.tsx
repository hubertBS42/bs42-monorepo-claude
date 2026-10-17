import type { FilterConfig } from "@workspace/tables"
import { ORG_ROLE_NAMES } from "@workspace/auth/organization-permissions"
import { STORE_ROLE_LABELS } from "@/components/user-badges"

export const memberFilters: FilterConfig[] = [
  { key: "name", label: "Name", type: "text", placeholder: "Search name" },
  { key: "email", label: "Email", type: "text", placeholder: "Search email" },
  {
    key: "role",
    label: "Role",
    type: "select",
    placeholder: "All roles",
    options: [{ label: "All roles", value: "all" }, ...ORG_ROLE_NAMES.map((role) => ({ label: STORE_ROLE_LABELS[role] ?? role, value: role }))],
  },
]
