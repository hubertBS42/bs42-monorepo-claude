import { StockMovementReason } from "@workspace/db/enums"

// Stock history reasons, shared by the listing form, its action and the history page (like order-status.ts)

export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReason, string> = {
  INITIAL: "Initial stock",
  SALE: "Sale",
  CANCELLATION: "Order cancelled",
  RETURN: "Return",
  PURCHASE_RECEIVED: "Purchase order received",
  TRANSFER_OUT: "Sent to another store",
  TRANSFER_IN: "Received from another store",
  TRANSFER_CANCELLED: "Transfer cancelled",
  COUNT_CORRECTION: "Count correction",
  DAMAGED: "Damaged",
  LOST: "Lost or stolen",
  OTHER: "Other",
}

// The reasons staff choose from when they change stock by hand on the listing form. OTHER needs a note.
export const MANUAL_STOCK_REASONS = [StockMovementReason.COUNT_CORRECTION, StockMovementReason.DAMAGED, StockMovementReason.LOST, StockMovementReason.OTHER] as const
export type ManualStockReason = (typeof MANUAL_STOCK_REASONS)[number]
