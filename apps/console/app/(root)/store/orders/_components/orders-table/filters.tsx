import type { FilterConfig } from "@workspace/tables"
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@workspace/commerce/order-status"

export const orderFilters: FilterConfig[] = [
  { key: "reference", label: "Reference", type: "text", placeholder: "Search reference" },
  { key: "customer", label: "Customer", type: "text", placeholder: "Name, email or phone" },
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
  {
    key: "paidBy",
    label: "Paid by",
    type: "select",
    placeholder: "Any method",
    options: [{ label: "Any method", value: "all" }, ...Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ label, value }))],
  },
  {
    key: "counterSale",
    label: "Counter sales",
    type: "boolean",
    placeholder: "Any",
    options: [
      { label: "Counter sales", value: "true" },
      { label: "Other orders", value: "false" },
    ],
  },
  {
    key: "multiStore",
    label: "Shared orders",
    type: "boolean",
    placeholder: "Any",
    options: [
      { label: "Shared with other stores", value: "true" },
      { label: "Only this store", value: "false" },
    ],
  },
  {
    key: "returned",
    label: "Returns",
    type: "boolean",
    placeholder: "Any",
    options: [
      { label: "Items returned", value: "true" },
      { label: "Nothing returned", value: "false" },
    ],
  },
  {
    key: "trade",
    label: "Trade",
    type: "boolean",
    placeholder: "Any",
    options: [
      { label: "Trade orders", value: "true" },
      { label: "Not trade", value: "false" },
    ],
  },
  { key: "placed", label: "Placed", type: "dateRange" },
]
