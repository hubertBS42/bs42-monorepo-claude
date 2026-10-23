import { Currency, PurchaseOrderStatus } from "@workspace/db/enums"
import { formatCurrency } from "@workspace/utils/currency"
import type { PurchasableListing } from "../types"

// Purchase order rules, shared by the actions and the pages (like order-status.ts)

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  ORDERED: "Ordered",
  PARTIALLY_RECEIVED: "Partly received",
  RECEIVED: "Received",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
}

// Ordered and not all here yet: what's left on these is the store's incoming stock, and deliveries can be received
export const OPEN_PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.PARTIALLY_RECEIVED]

export function isOpenPurchaseOrder(status: PurchaseOrderStatus) {
  return OPEN_PURCHASE_ORDER_STATUSES.includes(status)
}

// Open, and its expected day is before today (a plain yyyy-MM-dd day in the app's time zone, as getRateDate gives it):
// the list's Overdue filter and the dashboards' counts. expectedOn is a @db.Date, stored as midnight UTC.
export function overduePurchaseOrderWhere(today: string) {
  return { status: { in: OPEN_PURCHASE_ORDER_STATUSES }, expectedOn: { lt: new Date(`${today}T00:00:00Z`) } }
}

// A draft can change in every way. Once ordered, the supplier and currency stay; lines, quantities (never below what
// came in), costs, shipping, the expected day and notes can still change.
export function isEditablePurchaseOrder(status: PurchaseOrderStatus) {
  return status === PurchaseOrderStatus.DRAFT || isOpenPurchaseOrder(status)
}

// Cancelling stops an order before anything arrived; one that is partly here is closed instead, keeping what came in
export function cancelTarget(status: PurchaseOrderStatus): PurchaseOrderStatus | null {
  if (status === PurchaseOrderStatus.ORDERED) return PurchaseOrderStatus.CANCELLED
  if (status === PurchaseOrderStatus.PARTIALLY_RECEIVED) return PurchaseOrderStatus.CLOSED
  return null
}

// An amount in a purchase order's currency
export function formatCost(amount: string | number, currency: Currency) {
  return formatCurrency(String(amount), currency, currency === Currency.GHS ? "en-GH" : "en-US")
}

export interface SuggestedLine {
  listing: PurchasableListing
  row: PurchasableListing["rows"][number]
  quantity: number
}

// The lines a new purchase order starts with for listings picked on the listings table. Each row that tracks stock
// and is still at or under its low-stock threshold once what's already on its way arrives gets enough to reach twice
// the threshold (at least 1). A listing with no such row (not tracked, or enough already coming) gets each of its rows
// at 1, since it was picked on purpose. The user changes them as they like.
export function suggestPurchaseLines(listings: PurchasableListing[]): SuggestedLine[] {
  return listings.flatMap((listing) => {
    const low = listing.rows.filter((row) => row.stock !== null && row.stock + row.incoming <= listing.lowStockThreshold)
    if (low.length === 0) return listing.rows.map((row) => ({ listing, row, quantity: 1 }))
    return low.map((row) => ({ listing, row, quantity: Math.max(1, 2 * listing.lowStockThreshold - row.stock! - row.incoming) }))
  })
}
