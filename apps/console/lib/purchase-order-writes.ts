import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { Currency, PurchaseOrderStatus, Status, StockMovementReason } from "@workspace/db/enums"
import { formatDate } from "@workspace/utils/date"
import { cancelTarget, isEditablePurchaseOrder, isOpenPurchaseOrder } from "./purchase-order-status"
import { addStock } from "@workspace/commerce/stock-movements"

// A store's purchase orders: saving one, marking it ordered, receiving deliveries into stock, and cancelling or
// closing it. In their own module (like listing-sync.ts) so they can be tested against the database without a
// session. The actions check the input and the permission first.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx

export type PurchaseOrderErrorCode = "NOT_FOUND" | "CONFLICT" | "STATUS_CHANGED" | "RECEIPTS_CHANGED" | "SUPPLIER_UNAVAILABLE" | "ITEM_UNAVAILABLE" | "BELOW_RECEIVED" | "TOO_MANY" | "NO_RATE"

export class PurchaseOrderError extends Error {
  readonly code: PurchaseOrderErrorCode

  constructor(code: PurchaseOrderErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const notFound = () => new PurchaseOrderError("NOT_FOUND", "This purchase order no longer exists.")
const statusChanged = () => new PurchaseOrderError("STATUS_CHANGED", "Someone else changed this purchase order's status since the page loaded. Refresh the page to see it.")

export interface PurchaseLineInput {
  // A saved line's id; a new line has none
  id?: string
  listingId: string
  listingVariantId: string | null
  quantity: number
  // In the order's currency
  unitCost: Prisma.Decimal
}

export interface PurchaseOrderFields {
  supplierId: string
  currency: Currency
  shippingCost: Prisma.Decimal
  expectedOn: Date | null
  notes: string | null
  lines: PurchaseLineInput[]
}

// GHS per 1 USD. Needed to save an order in GHS; the actions refuse one without a current rate.
export type Rate = Prisma.Decimal | null

// A cost in the order's currency, in USD: rounded once, half up, like the order maths
export function toUsd(cost: Prisma.Decimal, currency: Currency, rate: Rate) {
  if (currency === Currency.USD) return cost
  if (!rate) {
    throw new PurchaseOrderError("NO_RATE", "There's no current exchange rate, so costs in GHS can't be converted. Use USD, or ask a platform admin to set today's rate in Settings.")
  }
  return cost.div(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

interface LineSnapshot {
  productName: string
  variantDescription: string | null
  sku: string | null
}

// Checks that each line is one of the store's listings (or a variant on it) that can still be bought in, and returns
// the snapshot kept on the line. Archived listings and archived variants can't.
async function resolvePurchaseLines(client: Client, storeId: string, lines: PurchaseLineInput[]): Promise<LineSnapshot[]> {
  if (!lines.length) return []
  const listings = await client.storeListing.findMany({
    where: { id: { in: lines.map((line) => line.listingId) }, organizationId: storeId },
    select: {
      id: true,
      status: true,
      product: { select: { name: true, sku: true, hasVariants: true } },
      storeListingVariants: {
        where: { id: { in: lines.flatMap((line) => (line.listingVariantId ? [line.listingVariantId] : [])) } },
        select: {
          id: true,
          variant: {
            select: {
              sku: true,
              status: true,
              variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } },
            },
          },
        },
      },
    },
  })
  const byId = new Map(listings.map((listing) => [listing.id, listing]))

  return lines.map((line) => {
    const listing = byId.get(line.listingId)
    if (!listing || listing.status === Status.ARCHIVED) throw new PurchaseOrderError("ITEM_UNAVAILABLE", `${listing?.product.name ?? "An item"} is no longer one of this store's listings.`)
    const { product } = listing

    // A product with variants is bought by variant, and one without by its listing
    const row = line.listingVariantId ? listing.storeListingVariants.find((variant) => variant.id === line.listingVariantId) : undefined
    if (product.hasVariants !== !!line.listingVariantId || (line.listingVariantId && (!row || row.variant.status === Status.ARCHIVED))) {
      throw new PurchaseOrderError("ITEM_UNAVAILABLE", `A variant of ${product.name} is no longer available. Remove it and add it again.`)
    }

    const values = row ? [...row.variant.variantValues].sort((a, b) => a.optionValue.option.position - b.optionValue.option.position) : []
    const variantDescription = values.length ? values.map(({ optionValue }) => `${optionValue.option.name}: ${optionValue.value}`).join(" / ") : null
    return { productName: product.name, variantDescription, sku: row?.variant.sku ?? product.sku }
  })
}

async function checkSupplier(client: Client, storeId: string, supplierId: string) {
  const supplier = await client.supplier.findFirst({ where: { id: supplierId, organizationId: storeId, isArchived: false }, select: { id: true } })
  if (!supplier) throw new PurchaseOrderError("SUPPLIER_UNAVAILABLE", "That supplier no longer exists or is archived. Choose another.")
}

export interface NewPurchaseOrder {
  storeId: string
  createdById: string
  fields: PurchaseOrderFields
  rate: Rate
}

// Saves a new draft. Nothing changes in stock until it's marked as ordered and received.
export async function createPurchaseOrder(tx: Tx, { storeId, createdById, fields, rate }: NewPurchaseOrder) {
  await checkSupplier(tx, storeId, fields.supplierId)
  const snapshots = await resolvePurchaseLines(tx, storeId, fields.lines)

  // PO-20261019-00042, numbered by a sequence (see its migration)
  const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('purchase_order_reference_seq')`
  const reference = `PO-${formatDate(new Date(), "yyyyMMdd")}-${String(nextval).padStart(5, "0")}`

  return tx.purchaseOrder.create({
    data: {
      organizationId: storeId,
      supplierId: fields.supplierId,
      reference,
      currency: fields.currency,
      exchangeRate: fields.currency === Currency.GHS ? rate : null,
      shippingCost: fields.shippingCost,
      expectedOn: fields.expectedOn,
      notes: fields.notes,
      createdById,
      items: {
        create: fields.lines.map((line, index) => ({
          storeListingId: line.listingId,
          storeListingVariantId: line.listingVariantId,
          ...snapshots[index]!,
          quantityOrdered: line.quantity,
          unitCost: line.unitCost,
          unitCostUsd: toUsd(line.unitCost, fields.currency, rate),
          position: index,
        })),
      },
    },
    select: { id: true, reference: true },
  })
}

// Locks the purchase order until the transaction ends, so edits, deliveries and cancellations on it wait their turn,
// and returns it with its lines
async function lockPurchaseOrder(tx: Tx, storeId: string, id: string) {
  await tx.$queryRaw`SELECT 1 FROM "purchase_order" WHERE "id" = ${id}::uuid FOR UPDATE`
  const order = await tx.purchaseOrder.findFirst({
    where: { id, organizationId: storeId },
    select: {
      status: true,
      currency: true,
      exchangeRate: true,
      updatedAt: true,
      _count: { select: { receipts: true } },
      items: {
        select: {
          id: true,
          storeListingId: true,
          storeListingVariantId: true,
          productName: true,
          variantDescription: true,
          quantityOrdered: true,
          quantityReceived: true,
          unitCostUsd: true,
          storeListing: { select: { trackInventory: true } },
          storeListingVariant: { select: { trackInventory: true } },
        },
        orderBy: { position: "asc" },
      },
    },
  })
  if (!order) throw notFound()
  return order
}

const label = (line: { productName: string; variantDescription: string | null }) => (line.variantDescription ? `${line.productName} (${line.variantDescription})` : line.productName)

export interface PurchaseOrderUpdate {
  storeId: string
  id: string
  // The updatedAt the form loaded: a save from a stale form is refused
  version: Date
  fields: PurchaseOrderFields
  // Used while it's a draft. An ordered one keeps the rate it was ordered at.
  rate: Rate
}

// Saves an edit. A draft takes any change (its lines are checked and their snapshots refreshed); an ordered one keeps
// its supplier and currency, and its lines keep at least what has come in. Returns the status, which becomes RECEIVED
// when the edit leaves nothing to come.
export async function updatePurchaseOrder(tx: Tx, { storeId, id, version, fields, rate }: PurchaseOrderUpdate) {
  const saved = await lockPurchaseOrder(tx, storeId, id)
  if (saved.updatedAt.getTime() !== version.getTime()) {
    throw new PurchaseOrderError("CONFLICT", "Someone else changed this purchase order while you were editing. Refresh the page to see their changes, then make yours again.")
  }
  if (!isEditablePurchaseOrder(saved.status)) throw statusChanged()

  const isDraft = saved.status === PurchaseOrderStatus.DRAFT
  const currency = isDraft ? fields.currency : saved.currency
  const orderRate = isDraft ? (currency === Currency.GHS ? rate : null) : saved.exchangeRate
  if (isDraft) await checkSupplier(tx, storeId, fields.supplierId)

  // Saved lines are matched by id and keep their listing; the rest are new
  const savedLines = new Map(saved.items.map((item) => [item.id, item]))
  for (const line of fields.lines) {
    if (line.id && !savedLines.has(line.id)) throw new PurchaseOrderError("CONFLICT", "A line on this purchase order was removed meanwhile. Refresh the page.")
  }
  const keptIds = new Set(fields.lines.flatMap((line) => (line.id ? [line.id] : [])))
  for (const item of saved.items) {
    if (keptIds.has(item.id)) continue
    if (item.quantityReceived > 0) throw new PurchaseOrderError("BELOW_RECEIVED", `${label(item)} has started to arrive, so it can't be removed.`)
  }

  const lines = fields.lines.map((line) => {
    const savedLine = line.id ? savedLines.get(line.id) : undefined
    if (savedLine && line.quantity < savedLine.quantityReceived) {
      throw new PurchaseOrderError("BELOW_RECEIVED", `${savedLine.quantityReceived} of ${label(savedLine)} have arrived, so it can't be ordered in fewer.`)
    }
    return { ...line, listingId: savedLine?.storeListingId ?? line.listingId, listingVariantId: savedLine ? savedLine.storeListingVariantId : line.listingVariantId, savedLine }
  })

  // A draft's lines are all checked again; once ordered, only new ones are (an ordered line stays even if its
  // listing is archived later, so it can still be received)
  const toCheck = isDraft ? lines : lines.filter((line) => !line.savedLine)
  const checked = await resolvePurchaseLines(tx, storeId, toCheck)
  const snapshots = new Map(toCheck.map((line, index) => [line, checked[index]!]))

  await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id, id: { notIn: [...keptIds] } } })
  for (const [index, line] of lines.entries()) {
    const values = {
      quantityOrdered: line.quantity,
      unitCost: line.unitCost,
      unitCostUsd: toUsd(line.unitCost, currency, orderRate),
      position: index,
      ...snapshots.get(line),
    }
    if (line.savedLine) await tx.purchaseOrderItem.update({ where: { id: line.savedLine.id }, data: values })
    else await tx.purchaseOrderItem.create({ data: { ...values, ...snapshots.get(line)!, purchaseOrderId: id, storeListingId: line.listingId, storeListingVariantId: line.listingVariantId } })
  }

  // An ordered line cut back to what has come in leaves nothing to receive
  const allHere = lines.every((line) => line.quantity === (line.savedLine?.quantityReceived ?? 0))
  const status = !isDraft && allHere ? PurchaseOrderStatus.RECEIVED : saved.status

  await tx.purchaseOrder.update({
    where: { id },
    data: {
      ...(isDraft && { supplierId: fields.supplierId, currency, exchangeRate: orderRate }),
      shippingCost: fields.shippingCost,
      expectedOn: fields.expectedOn,
      notes: fields.notes,
      status,
    },
  })
  return { status }
}

// Sends a draft: its lines become incoming stock. An order in GHS takes the day's rate now, which its lines' USD
// costs (what buy prices are set to) keep from then on.
export async function markPurchaseOrdered(tx: Tx, { storeId, id, orderedById, rate }: { storeId: string; id: string; orderedById: string; rate: Rate }) {
  const saved = await lockPurchaseOrder(tx, storeId, id)
  if (saved.status !== PurchaseOrderStatus.DRAFT) throw statusChanged()

  if (saved.currency === Currency.GHS) {
    const items = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: id }, select: { id: true, unitCost: true } })
    for (const item of items) await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { unitCostUsd: toUsd(item.unitCost, saved.currency, rate) } })
  }

  await tx.purchaseOrder.update({
    where: { id },
    data: { status: PurchaseOrderStatus.ORDERED, orderedAt: new Date(), orderedById, ...(saved.currency === Currency.GHS && { exchangeRate: rate }) },
  })
}

export interface ReceiptInput {
  storeId: string
  id: string
  // How many deliveries the page showed, so the same delivery can't be received twice
  receiptCount: number
  // One entry per line that came in
  items: { purchaseOrderItemId: string; quantity: number }[]
  // Set each line's listing (or variant) buy price to its cost in USD
  updateBuyPrices: boolean
  note: string | null
  receivedById: string
}

// Adds a delivery to stock, on the rows that track it, and returns the order's new status
export async function receivePurchaseOrder(tx: Tx, input: ReceiptInput) {
  const saved = await lockPurchaseOrder(tx, input.storeId, input.id)
  if (saved._count.receipts !== input.receiptCount) {
    throw new PurchaseOrderError("RECEIPTS_CHANGED", "Someone else received a delivery on this purchase order since the page loaded. Refresh the page to see it.")
  }
  if (!isOpenPurchaseOrder(saved.status)) throw statusChanged()

  const lines = new Map(saved.items.map((item) => [item.id, item]))
  const receiving = input.items.map((entry) => {
    const line = lines.get(entry.purchaseOrderItemId)
    if (!line) throw new PurchaseOrderError("CONFLICT", "A line being received is no longer on this purchase order. Refresh the page.")
    const left = line.quantityOrdered - line.quantityReceived
    if (entry.quantity > left) throw new PurchaseOrderError("TOO_MANY", `Only ${left} of ${label(line)} ${left === 1 ? "is" : "are"} still to come. Raise the ordered quantity first.`)
    return { line, quantity: entry.quantity }
  })

  const receipt = await tx.purchaseOrderReceipt.create({
    select: { id: true },
    data: {
      purchaseOrderId: input.id,
      receivedById: input.receivedById,
      note: input.note,
      updatedBuyPrices: input.updateBuyPrices,
      items: { create: receiving.map(({ line, quantity }) => ({ purchaseOrderItemId: line.id, quantity })) },
    },
  })

  for (const { line, quantity } of receiving) {
    await tx.purchaseOrderItem.update({ where: { id: line.id }, data: { quantityReceived: { increment: quantity } } })

    if (input.updateBuyPrices) {
      if (line.storeListingVariantId) await tx.storeListingVariant.update({ where: { id: line.storeListingVariantId }, data: { buyPrice: line.unitCostUsd } })
      else await tx.storeListing.update({ where: { id: line.storeListingId }, data: { buyPrice: line.unitCostUsd } })
    }

    // Stock goes up only on a row that tracks it, as sales take it down only there
    const tracks = line.storeListingVariantId ? (line.storeListingVariant?.trackInventory ?? false) : line.storeListing.trackInventory
    if (tracks) {
      await addStock(tx, { listingId: line.storeListingId, listingVariantId: line.storeListingVariantId }, quantity, {
        reason: StockMovementReason.PURCHASE_RECEIVED,
        createdById: input.receivedById,
        purchaseOrderReceiptId: receipt.id,
      })
    }
  }

  const received = new Map(receiving.map(({ line, quantity }) => [line.id, quantity]))
  const allHere = saved.items.every((item) => item.quantityReceived + (received.get(item.id) ?? 0) === item.quantityOrdered)
  const status = allHere ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED
  await tx.purchaseOrder.update({ where: { id: input.id }, data: { status } })
  return { status }
}

// Cancels an order nothing has arrived on, or closes one that is partly here (what came in stays in stock). Only
// from the status the page showed.
export async function cancelPurchaseOrder(tx: Tx, { storeId, id, from, reason, closedById }: { storeId: string; id: string; from: PurchaseOrderStatus; reason: string; closedById: string }) {
  const saved = await lockPurchaseOrder(tx, storeId, id)
  const to = cancelTarget(saved.status)
  if (saved.status !== from || !to) throw statusChanged()

  await tx.purchaseOrder.update({ where: { id }, data: { status: to, closedAt: new Date(), closedById, closeReason: reason } })
  return { status: to }
}

// Only a draft can be deleted: once ordered, the order is kept and cancelled instead
export async function deleteDraftPurchaseOrder(client: Client, { storeId, id }: { storeId: string; id: string }) {
  const { count } = await client.purchaseOrder.deleteMany({ where: { id, organizationId: storeId, status: PurchaseOrderStatus.DRAFT } })
  if (count === 0) throw statusChanged()
}
