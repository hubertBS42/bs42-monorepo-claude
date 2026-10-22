import type { FilterConfig } from "@workspace/tables"

export const filters: FilterConfig[] = [
  { key: "search", label: "Search", type: "text", placeholder: "Product, customer or title" },
  {
    key: "rating",
    label: "Rating",
    type: "select",
    placeholder: "All ratings",
    options: [{ label: "All ratings", value: "all" }, ...[5, 4, 3, 2, 1].map((rating) => ({ label: rating === 1 ? "1 star" : `${rating} stars`, value: String(rating) }))],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    placeholder: "All statuses",
    options: [
      { label: "All statuses", value: "all" },
      { label: "Published", value: "PUBLISHED" },
      { label: "Hidden", value: "HIDDEN" },
    ],
  },
]
