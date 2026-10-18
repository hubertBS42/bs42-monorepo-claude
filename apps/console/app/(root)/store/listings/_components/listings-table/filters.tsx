import type { FilterConfig } from "@workspace/tables"
import { LISTING_STOCK_OPTIONS, STATUS_OPTIONS } from "@/constants"
import type { ProductFilterOptions } from "@/lib/data/products.data"

export function getListingFilters({ brands, categories }: ProductFilterOptions): FilterConfig[] {
  return [
    { key: "search", label: "Search", type: "text", placeholder: "Search name or SKU" },
    { key: "status", label: "Status", type: "select", placeholder: "All statuses", options: [{ label: "All statuses", value: "all" }, ...STATUS_OPTIONS] },
    // As the stock column's badges show it: a listing with variants counts its variants on sale
    { key: "stock", label: "Stock", type: "select", placeholder: "Any stock", options: [{ label: "Any stock", value: "all" }, ...LISTING_STOCK_OPTIONS] },
    { key: "brandId", label: "Brand", type: "select", placeholder: "All brands", options: [{ label: "All brands", value: "all" }, ...brands] },
    // Choosing a category also shows the listings in the categories under it
    { key: "categoryId", label: "Category", type: "select", placeholder: "All categories", options: [{ label: "All categories", value: "all" }, ...categories] },
    {
      key: "visible",
      label: "Visible to customers",
      type: "boolean",
      placeholder: "All listings",
      options: [
        { label: "Visible", value: "true" },
        { label: "Not visible", value: "false" },
      ],
    },
  ]
}
