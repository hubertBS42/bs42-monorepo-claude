import type { FilterConfig } from "@workspace/tables"
import { CONDITION_OPTIONS, STATUS_OPTIONS } from "@/constants"
import type { ProductFilterOptions } from "@/lib/data/products.data"

export function getProductFilters({ brands, categories }: ProductFilterOptions): FilterConfig[] {
  return [
    { key: "search", label: "Search", type: "text", placeholder: "Search name, SKU or barcode" },
    { key: "brandId", label: "Brand", type: "select", placeholder: "All brands", options: [{ label: "All brands", value: "all" }, ...brands] },
    // Choosing a category also shows the products in the categories under it
    { key: "categoryId", label: "Category", type: "tree", placeholder: "All categories", tree: categories },
    { key: "condition", label: "Condition", type: "select", placeholder: "All conditions", options: [{ label: "All conditions", value: "all" }, ...CONDITION_OPTIONS] },
    {
      key: "hasVariants",
      label: "Variants",
      type: "boolean",
      placeholder: "All products",
      options: [
        { label: "With variants", value: "true" },
        { label: "Without variants", value: "false" },
      ],
    },
    { key: "status", label: "Status", type: "select", placeholder: "All statuses", options: [{ label: "All statuses", value: "all" }, ...STATUS_OPTIONS] },
    {
      key: "incomplete",
      label: "Details",
      type: "boolean",
      placeholder: "All products",
      options: [
        { label: "Missing details", value: "true" },
        { label: "Complete", value: "false" },
      ],
    },
  ]
}
