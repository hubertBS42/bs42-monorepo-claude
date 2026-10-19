import type { FilterConfig } from "@workspace/tables"

export const supplierFilters: FilterConfig[] = [
  { key: "name", label: "Name", type: "text", placeholder: "Search name" },
  { key: "archived", label: "Archived", type: "boolean" },
]
