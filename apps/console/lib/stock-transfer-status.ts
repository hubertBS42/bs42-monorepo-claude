import type { StockTransferStatus } from "@workspace/db/enums"

// Stock transfers' words and who may send them, shared by the pages, the loaders and the actions (like
// purchase-order-status.ts)

export const STOCK_TRANSFER_STATUS_LABELS: Record<StockTransferStatus, string> = {
  SENT: "On its way",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
}

// The store roles that can send a transfer from a store or to one (whoever manages it), and cancel one
export const TRANSFER_ROLES: readonly string[] = ["owner", "admin"]
