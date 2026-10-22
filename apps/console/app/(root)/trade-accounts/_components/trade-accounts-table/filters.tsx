import type { FilterConfig } from "@workspace/tables"
import { BUSINESS_TYPE_OPTIONS, TRADE_ACCOUNT_STATUS_LABELS } from "@workspace/commerce/trade-account-status"

export const filters: FilterConfig[] = [
  { key: "search", label: "Search", type: "text", placeholder: "Company, TIN or customer" },
  {
    key: "status",
    label: "Status",
    type: "select",
    placeholder: "All statuses",
    options: [{ label: "All statuses", value: "all" }, ...Object.entries(TRADE_ACCOUNT_STATUS_LABELS).map(([value, label]) => ({ label, value }))],
  },
  {
    key: "businessType",
    label: "Business",
    type: "select",
    placeholder: "All businesses",
    options: [{ label: "All businesses", value: "all" }, ...BUSINESS_TYPE_OPTIONS],
  },
]
