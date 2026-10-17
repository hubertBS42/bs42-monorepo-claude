import type { FilterConfig } from "@workspace/tables"
import { STATUS_OPTIONS } from "@/constants"

export const filters: FilterConfig[] = [
  { key: "search", label: "Search", type: "text", placeholder: "Search name, SKU or barcode" },
  { key: "status", label: "Status", type: "select", placeholder: "All statuses", options: [{ label: "All statuses", value: "all" }, ...STATUS_OPTIONS] },
]
