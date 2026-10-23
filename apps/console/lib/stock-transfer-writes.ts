import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { Status, StockMovementReason, StockTransferStatus } from "@workspace/db/enums"
import { formatDate } from "@workspace/utils/date"
import { addStock, recordStockMovement } from "@workspace/commerce/stock-movements"
import { describeVariant } from "@workspace/commerce/order-writes"

// Stock transfers between two stores: sending one (the stock leaves the sender's listings at once), receiving it
// (what arrived is added to the receiver's; the rest was lost on the way) and cancelling it before then (the stock
// goes back). In their own module (like purchase-order-writes.ts) so they can be tested against the database without
// a session. The actions check the input and the permissions first.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export type StockTransferErrorCode = "NOT_FOUND" | "STATUS_CHANGED" | "ITEM_UNAVAILABLE" | "NOT_TRACKED" | "NOT_LISTED" | "INSUFFICIENT_STOCK" | "TOO_MANY" | "CONFLICT"

export class StockTransferError extends Error {
  readonly code: StockTransferErrorCode

  constructor(code: StockTransferErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const statusChanged = () => new StockTransferError("STATUS_CHANGED", "Someone else received or cancelled this transfer since the page loaded. Refresh the page to see it.")

// A listing's own stock (a product without variants), or a variant's on it
export interface TransferLineInput {
  listingId: string
  listingVariantId: string | null
  quantity: number
}

export interface NewStockTransfer {
  fromStoreId: string
  toStoreId: string
  sentById: string
  notes: string | null
  lines: TransferLineInput[]
}

const label = (line: { productName: string; variantDescription: string | null }) => (line.variantDescription ? `${line.productName} (${line.variantDescription})` : line.productName)

const nameList = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", "))

// Each line's row in the sender's store, and the receiver's listing (and variant) of the same product: both must be
// there and not archived, and the sender's must track stock, since a transfer takes it from a count
async function resolveTransferLines(tx: Tx, { fromStoreId, toStoreId, lines }: NewStockTransfer) {
  const variantIds = lines.flatMap((line) => (line.listingVariantId ? [line.listingVariantId] : []))
  const sources = await tx.storeListing.findMany({
    where: { id: { in: lines.map((line) => line.listingId) }, organizationId: fromStoreId },
    select: {
      id: true,
      status: true,
      trackInventory: true,
      productId: true,
      product: { select: { name: true, sku: true, hasVariants: true } },
      storeListingVariants: {
        where: { id: { in: variantIds } },
        select: {
          id: true,
          trackInventory: true,
          variantId: true,
          variant: { select: { sku: true, status: true, variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } } } },
        },
      },
    },
  })
  const sourceById = new Map(sources.map((listing) => [listing.id, listing]))

  const resolved = lines.map((line) => {
    const listing = sourceById.get(line.listingId)
    if (!listing || listing.status === Status.ARCHIVED) throw new StockTransferError("ITEM_UNAVAILABLE", `${listing?.product.name ?? "An item"} is no longer one of this store's listings.`)
    const row = line.listingVariantId ? listing.storeListingVariants.find((variant) => variant.id === line.listingVariantId) : undefined
    if (listing.product.hasVariants !== !!line.listingVariantId || (line.listingVariantId && (!row || row.variant.status === Status.ARCHIVED))) {
      throw new StockTransferError("ITEM_UNAVAILABLE", `A variant of ${listing.product.name} is no longer available. Remove it and add it again.`)
    }
    const snapshot = { productName: listing.product.name, variantDescription: row ? describeVariant(row.variant.variantValues) : null, sku: row?.variant.sku ?? listing.product.sku }
    if (!(row ? row.trackInventory : listing.trackInventory)) throw new StockTransferError("NOT_TRACKED", `${label(snapshot)} doesn't track stock here, so there's no count to send from.`)
    return { line, listing, row, snapshot }
  })

  const targets = await tx.storeListing.findMany({
    where: { organizationId: toStoreId, productId: { in: resolved.map(({ listing }) => listing.productId) }, status: { not: Status.ARCHIVED } },
    select: { id: true, productId: true, storeListingVariants: { select: { id: true, variantId: true } } },
  })
  const targetByProduct = new Map(targets.map((listing) => [listing.productId, listing]))

  const missing: string[] = []
  const withTargets = resolved.map((item) => {
    const target = targetByProduct.get(item.listing.productId)
    const targetVariant = item.row ? target?.storeListingVariants.find((variant) => variant.variantId === item.row!.variantId) : undefined
    if (!target || (item.row && !targetVariant)) missing.push(label(item.snapshot))
    return { ...item, toListingId: target?.id ?? "", toListingVariantId: targetVariant?.id ?? null }
  })
  if (missing.length) throw new StockTransferError("NOT_LISTED", `The other store doesn't list ${nameList(missing)}. They need to list ${missing.length === 1 ? "it" : "them"} first.`)
  return withTargets
}

// Sends a transfer: the stock leaves the sender's rows now, each guarded so it can't go below 0 (a sale may have taken
// some since the page loaded)
export async function createStockTransfer(tx: Tx, input: NewStockTransfer) {
  const lines = await resolveTransferLines(tx, input)

  // TR-20261024-00042, numbered by a sequence (see its migration)
  const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('stock_transfer_reference_seq')`
  const transfer = await tx.stockTransfer.create({
    data: {
      reference: `TR-${formatDate(new Date(), "yyyyMMdd")}-${String(nextval).padStart(5, "0")}`,
      fromStoreId: input.fromStoreId,
      toStoreId: input.toStoreId,
      sentById: input.sentById,
      notes: input.notes,
      items: {
        create: lines.map(({ line, snapshot, toListingId, toListingVariantId }, position) => ({
          fromListingId: line.listingId,
          fromListingVariantId: line.listingVariantId,
          toListingId,
          toListingVariantId,
          ...snapshot,
          quantity: line.quantity,
          position,
        })),
      },
    },
    select: { id: true, reference: true },
  })

  const short: string[] = []
  for (const { line, snapshot } of lines) {
    try {
      // The stock condition makes the update miss (P2025) rather than go below 0
      const { stock } = line.listingVariantId
        ? await tx.storeListingVariant.update({ where: { id: line.listingVariantId, stock: { gte: line.quantity } }, data: { stock: { decrement: line.quantity } }, select: { stock: true } })
        : await tx.storeListing.update({ where: { id: line.listingId, stock: { gte: line.quantity } }, data: { stock: { decrement: line.quantity } }, select: { stock: true } })
      await recordStockMovement(tx, { listingId: line.listingId, listingVariantId: line.listingVariantId }, -line.quantity, stock, {
        reason: StockMovementReason.TRANSFER_OUT,
        createdById: input.sentById,
        stockTransferId: transfer.id,
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2025") throw error
      short.push(label(snapshot))
    }
  }
  // Rolls the whole transfer back
  if (short.length) throw new StockTransferError("INSUFFICIENT_STOCK", `There isn't enough stock of ${nameList(short)} to send. Lower the quantity.`)
  return transfer
}

async function lockTransfer(tx: Tx, id: string, where: { fromStoreId: string } | { toStoreId: string }) {
  await tx.$queryRaw`SELECT 1 FROM "stock_transfer" WHERE "id" = ${id}::uuid FOR UPDATE`
  const transfer = await tx.stockTransfer.findFirst({
    where: { id, ...where },
    select: {
      status: true,
      items: {
        select: {
          id: true,
          fromListingId: true,
          fromListingVariantId: true,
          toListingId: true,
          toListingVariantId: true,
          productName: true,
          variantDescription: true,
          quantity: true,
          toListing: { select: { trackInventory: true } },
          toListingVariant: { select: { trackInventory: true } },
        },
      },
    },
  })
  if (!transfer) throw new StockTransferError("NOT_FOUND", "This transfer no longer exists.")
  return transfer
}

export interface TransferReceipt {
  // The receiving store
  storeId: string
  id: string
  // How many of each line arrived, every line once; the rest was lost on the way
  items: { itemId: string; quantity: number }[]
  note: string | null
  receivedById: string
}

// Receives a sent transfer once: adds what arrived to the receiver's rows that track stock (one that doesn't just
// records it, as a purchase order delivery does)
export async function receiveStockTransfer(tx: Tx, input: TransferReceipt) {
  const transfer = await lockTransfer(tx, input.id, { toStoreId: input.storeId })
  if (transfer.status !== StockTransferStatus.SENT) throw statusChanged()

  const received = new Map(input.items.map((entry) => [entry.itemId, entry.quantity]))
  if (received.size !== input.items.length || transfer.items.some((item) => !received.has(item.id)) || input.items.length !== transfer.items.length) {
    throw new StockTransferError("CONFLICT", "The transfer's lines don't match the page. Refresh the page.")
  }

  for (const item of transfer.items) {
    const quantity = received.get(item.id)!
    if (quantity > item.quantity) throw new StockTransferError("TOO_MANY", `Only ${item.quantity} of ${label(item)} ${item.quantity === 1 ? "was" : "were"} sent.`)
    await tx.stockTransferItem.update({ where: { id: item.id }, data: { quantityReceived: quantity } })

    const tracks = item.toListingVariantId ? (item.toListingVariant?.trackInventory ?? false) : item.toListing.trackInventory
    if (quantity > 0 && tracks) {
      await addStock(tx, { listingId: item.toListingId, listingVariantId: item.toListingVariantId }, quantity, {
        reason: StockMovementReason.TRANSFER_IN,
        createdById: input.receivedById,
        stockTransferId: input.id,
      })
    }
  }

  await tx.stockTransfer.update({ where: { id: input.id }, data: { status: StockTransferStatus.RECEIVED, receivedById: input.receivedById, receivedAt: new Date(), receiveNote: input.note } })
}

// The sender takes a transfer back before it's received: every unit goes back where it came from (those rows tracked
// stock when it was sent)
export async function cancelStockTransfer(tx: Tx, { storeId, id, reason, cancelledById }: { storeId: string; id: string; reason: string; cancelledById: string }) {
  const transfer = await lockTransfer(tx, id, { fromStoreId: storeId })
  if (transfer.status !== StockTransferStatus.SENT) throw statusChanged()

  for (const item of transfer.items) {
    await addStock(tx, { listingId: item.fromListingId, listingVariantId: item.fromListingVariantId }, item.quantity, {
      reason: StockMovementReason.TRANSFER_CANCELLED,
      createdById: cancelledById,
      stockTransferId: id,
    })
  }
  await tx.stockTransfer.update({ where: { id }, data: { status: StockTransferStatus.CANCELLED, cancelledById, cancelledAt: new Date(), cancelReason: reason } })
}
