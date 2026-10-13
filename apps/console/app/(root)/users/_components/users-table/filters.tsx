import type { FilterConfig } from "@workspace/tables"

export const filters: FilterConfig[] = [
  { key: "name", label: "Name", type: "text", placeholder: "Search name" },
  { key: "email", label: "Email", type: "text", placeholder: "Search email" },
]
