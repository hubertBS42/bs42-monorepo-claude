import type { FilterConfig } from "@workspace/tables"
import { PURCHASE_ORDER_STATUS_LABELS } from "@/lib/purchase-order-status"
import type { SelectItem } from "@/types"

// A store's list filters by its suppliers; the platform's by store (suppliers are each store's own)
export function purchaseOrderFilters({ suppliers, stores }: { suppliers?: SelectItem[]; stores?: SelectItem[] }): FilterConfig[] {
  return [
    { key: "reference", label: "Reference", type: "text", placeholder: "Search reference" },
    ...(stores
      ? [
          {
            key: "storeId",
            label: "Store",
            type: "select" as const,
            placeholder: "All stores",
            options: [{ label: "All stores", value: "all" }, ...stores.map((store) => ({ label: store.name, value: store.id }))],
          },
        ]
      : []),
    {
      key: "status",
      label: "Status",
      type: "select",
      placeholder: "All statuses",
      options: [{ label: "All statuses", value: "all" }, ...Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => ({ label, value }))],
    },
    {
      key: "overdue",
      label: "Delivery",
      type: "select",
      placeholder: "Any delivery day",
      options: [
        { label: "Any delivery day", value: "all" },
        { label: "Overdue", value: "true" },
      ],
    },
    ...(suppliers
      ? [
          {
            key: "supplierId",
            label: "Supplier",
            type: "select" as const,
            placeholder: "All suppliers",
            options: [{ label: "All suppliers", value: "all" }, ...suppliers.map((supplier) => ({ label: supplier.name, value: supplier.id }))],
          },
        ]
      : []),
  ]
}
