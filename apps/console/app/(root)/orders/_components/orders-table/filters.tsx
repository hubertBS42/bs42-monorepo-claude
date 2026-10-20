import type { FilterConfig } from "@workspace/tables"
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@workspace/commerce/order-status"

export function getOrderFilters(stores: { label: string; value: string }[]): FilterConfig[] {
  return [
    { key: "reference", label: "Reference", type: "text", placeholder: "Search reference" },
    { key: "customer", label: "Customer", type: "text", placeholder: "Name, email or phone" },
    // Orders with any of the store's items, including ones shared with other stores
    { key: "storeId", label: "Store", type: "select", placeholder: "All stores", options: [{ label: "All stores", value: "all" }, ...stores] },
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
      key: "multiStore",
      label: "Stores on the order",
      type: "boolean",
      placeholder: "Any",
      options: [
        { label: "More than one store", value: "true" },
        { label: "One store", value: "false" },
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
    { key: "placed", label: "Placed", type: "dateRange" },
  ]
}
