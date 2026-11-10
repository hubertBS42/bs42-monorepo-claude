import type { FilterConfig } from "@workspace/tables"
import { CONDITION_OPTIONS, LISTING_BUY_PRICE_OPTIONS, LISTING_STOCK_OPTIONS, STATUS_OPTIONS } from "@/constants"
import type { ProductFilterOptions } from "@/lib/data/products.data"

export function getListingFilters({ brands, categories }: ProductFilterOptions): FilterConfig[] {
  return [
    { key: "search", label: "Search", type: "text", placeholder: "Search name or SKU" },
    { key: "status", label: "Status", type: "select", placeholder: "All statuses", options: [{ label: "All statuses", value: "all" }, ...STATUS_OPTIONS] },
    // As the stock column's badges show it: a listing with variants counts its variants on sale
    { key: "stock", label: "Stock", type: "select", placeholder: "Any stock", options: [{ label: "Any stock", value: "all" }, ...LISTING_STOCK_OPTIONS] },
    // On what's sold, as the profit report counts it: the listing, or its variants on sale with their own prices or the listing's
    { key: "buyPrice", label: "Buy price", type: "select", placeholder: "Any buy price", options: [{ label: "Any buy price", value: "all" }, ...LISTING_BUY_PRICE_OPTIONS] },
    { key: "brandId", label: "Brand", type: "select", placeholder: "All brands", options: [{ label: "All brands", value: "all" }, ...brands] },
    // Choosing a category also shows the listings in the categories under it
    { key: "categoryId", label: "Category", type: "tree", placeholder: "All categories", tree: categories },
    { key: "condition", label: "Condition", type: "select", placeholder: "All conditions", options: [{ label: "All conditions", value: "all" }, ...CONDITION_OPTIONS] },
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
    {
      key: "featured",
      label: "Featured",
      type: "boolean",
      placeholder: "All listings",
      options: [
        { label: "Featured", value: "true" },
        { label: "Not featured", value: "false" },
      ],
    },
    {
      // "Sale", not "On sale": the table's "Not on sale" note means customers can't see the listing
      key: "sale",
      label: "Sale",
      type: "boolean",
      placeholder: "All listings",
      options: [
        { label: "Has a sale price", value: "true" },
        { label: "No sale price", value: "false" },
      ],
    },
  ]
}
