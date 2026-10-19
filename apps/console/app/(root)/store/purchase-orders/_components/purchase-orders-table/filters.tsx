import type { FilterConfig } from "@workspace/tables"
import { PURCHASE_ORDER_STATUS_LABELS } from "@/lib/purchase-order-status"
import type { SelectItem } from "@/types"

export function purchaseOrderFilters(suppliers: SelectItem[]): FilterConfig[] {
  return [
    { key: "reference", label: "Reference", type: "text", placeholder: "Search reference" },
    {
      key: "status",
      label: "Status",
      type: "select",
      placeholder: "All statuses",
      options: [{ label: "All statuses", value: "all" }, ...Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => ({ label, value }))],
    },
    {
      key: "supplierId",
      label: "Supplier",
      type: "select",
      placeholder: "All suppliers",
      options: [{ label: "All suppliers", value: "all" }, ...suppliers.map((supplier) => ({ label: supplier.name, value: supplier.id }))],
    },
  ]
}
