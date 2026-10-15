import type { FilterConfig } from "@workspace/tables"
import { SYSTEM_ROLE_NAMES } from "@workspace/auth/system-permissions"
import { ROLE_LABELS } from "@/components/user-badges"

// Super admins are hidden from everyone else, so only they get that role as a filter option
export function getUserFilters({ canSeeSuperAdmins }: { canSeeSuperAdmins: boolean }): FilterConfig[] {
  const roleOptions = SYSTEM_ROLE_NAMES.filter((role) => canSeeSuperAdmins || role !== "superAdmin").map((role) => ({ label: ROLE_LABELS[role] ?? role, value: role }))

  return [
    { key: "name", label: "Name", type: "text", placeholder: "Search name" },
    { key: "email", label: "Email", type: "text", placeholder: "Search email" },
    { key: "role", label: "Role", type: "select", placeholder: "All roles", options: [{ label: "All roles", value: "all" }, ...roleOptions] },
    {
      key: "status",
      label: "Status",
      type: "select",
      placeholder: "All statuses",
      options: [
        { label: "All statuses", value: "all" },
        { label: "Active", value: "active" },
        { label: "Banned", value: "banned" },
      ],
    },
  ]
}
