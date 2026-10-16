import type { FilterConfig } from "@workspace/tables"
import { STATUS_OPTIONS } from "@/constants"

export const filters: FilterConfig[] = [
  { key: "name", label: "Name", type: "text", placeholder: "Search name" },
  { key: "status", label: "Status", type: "select", placeholder: "All statuses", options: [{ label: "All statuses", value: "all" }, ...STATUS_OPTIONS] },
]
