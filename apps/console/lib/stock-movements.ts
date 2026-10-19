import "server-only"

import type { prisma } from "@workspace/db"
import type { StockMovementReason } from "@workspace/db/enums"

// The stock history: every change to a listing's (or variant's) stock writes a StockMovement in the same transaction,
// so the movements always add up to the current stock. Used by every module that changes stock (sales and
// cancellations, returns, purchase order deliveries, the listing form).

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// A listing's own stock (a product without variants), or a variant's on it
export interface StockRow {
  listingId: string
  listingVariantId: string | null
}

// Why the stock changed, who changed it and what caused it
export interface StockMovementSource {
  reason: StockMovementReason
  note?: string | null
  createdById: string | null
  orderId?: string
  orderReturnId?: string
  purchaseOrderReceiptId?: string
}

export interface RecordedMovement {
  row: StockRow
  change: number
  stockAfter: number
  source: StockMovementSource
}

// Records changes the caller has already written (with the stock each left), in one statement: e.g. an order's sales,
// reserved with a guard so stock can't go below 0. A change of 0 isn't a movement, so it's skipped.
export async function recordStockMovements(tx: Tx, movements: RecordedMovement[]) {
  const data = movements
    .filter((movement) => movement.change !== 0)
    .map(({ row, change, stockAfter, source }) => ({
      storeListingId: row.listingId,
      storeListingVariantId: row.listingVariantId,
      change,
      stockAfter,
      reason: source.reason,
      note: source.note ?? null,
      orderId: source.orderId,
      orderReturnId: source.orderReturnId,
      purchaseOrderReceiptId: source.purchaseOrderReceiptId,
      createdById: source.createdById,
    }))
  if (data.length) await tx.stockMovement.createMany({ data })
}

export async function recordStockMovement(tx: Tx, row: StockRow, change: number, stockAfter: number, source: StockMovementSource) {
  await recordStockMovements(tx, [{ row, change, stockAfter, source }])
}

// Adds stock to a row (a cancellation, a return, a delivery) and records it. Returns the stock after. Only adds: taking
// stock away needs a guard against going below 0, as a sale reserves it (store-order-writes.ts), then
// recordStockMovement.
export async function addStock(tx: Tx, row: StockRow, quantity: number, source: StockMovementSource) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`addStock takes a whole number above 0, not ${quantity}.`)
  const { stock } = row.listingVariantId
    ? await tx.storeListingVariant.update({ where: { id: row.listingVariantId }, data: { stock: { increment: quantity } }, select: { stock: true } })
    : await tx.storeListing.update({ where: { id: row.listingId }, data: { stock: { increment: quantity } }, select: { stock: true } })
  await recordStockMovement(tx, row, quantity, stock, source)
  return stock
}
