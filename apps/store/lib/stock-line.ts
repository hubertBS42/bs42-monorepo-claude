import { formatDate } from "@workspace/utils/date"

import type { StockState } from "@/lib/product-cards"

export type StockTone = "good" | "low" | "out"

// The Monday of a yyyy-MM-dd day's week, as yyyy-MM-dd (the days are UTC, as the app's zone is)
function weekCommencing(day: string) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

// What a card or product page says about stock. An expected day already past says only "On order": the supplier is
// late, so the day means nothing to a customer.
export function stockLine(stock: StockState, now = new Date()): { label: string; tone: StockTone } {
  if (stock.kind === "in-stock") return stock.left ? { label: `Only ${stock.left} left`, tone: "low" } : { label: "In stock", tone: "good" }
  if (!stock.onOrder) return { label: "Out of stock", tone: "out" }
  if (stock.dueOn) {
    const week = weekCommencing(stock.dueOn)
    if (week >= weekCommencing(formatDate(now, "yyyy-MM-dd"))) return { label: `Due w/c ${formatDate(`${week}T00:00:00Z`, "d MMM")}`, tone: "low" }
  }
  return { label: "On order", tone: "low" }
}
