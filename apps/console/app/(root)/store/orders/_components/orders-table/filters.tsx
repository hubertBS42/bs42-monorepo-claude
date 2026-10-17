import type { FilterConfig } from "@workspace/tables"
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-status"

export const orderFilters: FilterConfig[] = [
  { key: "reference", label: "Reference", type: "text", placeholder: "Search reference" },
  {
    key: "status",
    label: "Status",
    type: "select",
    placeholder: "All statuses",
    options: [{ label: "All statuses", value: "all" }, ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ label, value }))],
  },
  {
    key: "paymentStatus",
    label: "Payment",
    type: "select",
    placeholder: "All payments",
    options: [{ label: "All payments", value: "all" }, ...Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ label, value }))],
  },
]
