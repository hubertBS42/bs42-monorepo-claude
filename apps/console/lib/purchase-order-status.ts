import { Currency, PurchaseOrderStatus } from "@workspace/db/enums"
import { formatCurrency } from "@workspace/utils/currency"

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
