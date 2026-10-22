import type { FilterConfig } from "@workspace/tables"

export const filters: FilterConfig[] = [
  { key: "search", label: "Search", type: "text", placeholder: "Reference, customer or company" },
  {
    key: "status",
    label: "Status",
    type: "select",
    placeholder: "All statuses",
    options: [
      { label: "All statuses", value: "all" },
      { label: "Open", value: "open" },
      { label: "Expired", value: "expired" },
      { label: "Accepted", value: "accepted" },
      { label: "Cancelled", value: "cancelled" },
    ],
  },
  {
    key: "trade",
    label: "Trade",
    type: "boolean",
    placeholder: "Any",
    options: [
      { label: "Trade quotes", value: "true" },
      { label: "Not trade", value: "false" },
    ],
  },
  { key: "made", label: "Made", type: "dateRange" },
]
