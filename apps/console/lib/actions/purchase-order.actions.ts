"use server"

import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import { ActionResponse, DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { Currency } from "@workspace/db/enums"
import { hasStorePermission, requireConsoleAccess } from "@/lib/auth-guard"
import { getLatestExchangeRate } from "@workspace/commerce/exchange-rates"
import { findPurchasableListings } from "@/lib/data/purchase-orders.data"
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  deleteDraftPurchaseOrder,
  markPurchaseOrdered,
  PurchaseOrderError,
  receivePurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderFields,
  type Rate,
} from "@/lib/purchase-order-writes"
import {
  cancelPurchaseOrderSchema,
  createPurchaseOrderSchema,
  purchaseOrderFormSchema,
  purchaseOrderRefSchema,
  receivePurchaseOrderSchema,
  searchPurchasableListingsSchema,
  updatePurchaseOrderSchema,
} from "@/lib/schemas/purchase-order.schemas"
import type { PurchasableListing } from "@/types"

// Every export here is a public endpoint, so every input is validated, and each one calls requireConsoleAccess
// before its try block (its redirect throws, which the catch would swallow). The store id comes from the page, not
// the session's active organization, and the store role is checked against it.

type Failure = Extract<ActionResponse, { success: false }>

function invalidInput(error: z.ZodError): Failure {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const FORBIDDEN: Failure = { success: false, error: "Your role in this store can't do this.", code: "FORBIDDEN" }
const NOT_FOUND: Failure = { success: false, error: "This purchase order no longer exists.", code: "NOT_FOUND" }
const NO_RATE: Failure = {
  success: false,
  error: "There's no current exchange rate, so costs in GHS can't be converted. Use USD, or ask a platform admin to set today's rate in Settings.",
  code: "NO_RATE",
}

const NOTHING_RECEIVED: Failure = { success: false, error: "Enter how many of at least one item came in.", code: "INVALID" }

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

function writeError(error: unknown): Failure {
  if (error instanceof PurchaseOrderError) return { success: false, error: error.message, code: error.code }
  return { success: false, error: formatError(error) }
}

// GHS costs are converted with the latest rate, refused when it's too old (as orders are)
async function getRate(currency: Currency): Promise<{ ok: true; rate: Rate } | { ok: false }> {
  if (currency === Currency.USD) return { ok: true, rate: null }
  const rate = await getLatestExchangeRate()
  if (!rate || rate.isStale) return { ok: false }
  return { ok: true, rate: new Prisma.Decimal(rate.rate) }
}

function toFields(data: z.output<typeof purchaseOrderFormSchema>): PurchaseOrderFields {
  return {
    supplierId: data.supplierId,
    currency: data.currency,
    shippingCost: new Prisma.Decimal(data.shippingCost),
    // A @db.Date is stored as midnight UTC
    expectedOn: data.expectedOn ? new Date(`${data.expectedOn}T00:00:00Z`) : null,
    notes: data.notes,
    lines: data.lines.map((line) => ({ ...line, unitCost: new Prisma.Decimal(line.unitCost) })),
  }
}

// The store's listings that can be bought in (not archived), with their stock, what's already on its way and the
// last buy price as a starting cost
export async function searchPurchasableListingsAction(input: z.input<typeof searchPurchasableListingsSchema>): Promise<DataResponse<PurchasableListing[]>> {
  const session = await requireConsoleAccess()

  try {
    const parsed = searchPurchasableListingsSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, search } = parsed.data

    // Adding lines is part of creating an order, or of editing one
    const [canCreate, canUpdate] = await Promise.all([
      hasStorePermission(session.user.id, storeId, { purchaseOrder: ["create"] }),
      hasStorePermission(session.user.id, storeId, { purchaseOrder: ["update"] }),
    ])
    if (!canCreate && !canUpdate) return FORBIDDEN

    return { success: true, data: await findPurchasableListings(storeId, { search }) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function createPurchaseOrderAction(input: z.input<typeof createPurchaseOrderSchema>): Promise<DataResponse<{ id: string; reference: string }>> {
  const session = await requireConsoleAccess()

  try {
    const parsed = createPurchaseOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, ...data } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { purchaseOrder: ["create"] }))) return FORBIDDEN

    const rate = await getRate(data.currency)
    if (!rate.ok) return NO_RATE

    const order = await prisma.$transaction((tx) => createPurchaseOrder(tx, { storeId, createdById: session.user.id, fields: toFields(data), rate: rate.rate }), TRANSACTION_OPTIONS)
    return { success: true, data: order }
  } catch (error) {
    return writeError(error)
  }
}

export async function updatePurchaseOrderAction(input: z.input<typeof updatePurchaseOrderSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = updatePurchaseOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, id, version, ...data } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { purchaseOrder: ["update"] }))) return FORBIDDEN

    // Only a draft converts at today's rate; an ordered one keeps its own, so a missing rate doesn't matter there
    const rate = await getRate(data.currency)

    await prisma.$transaction((tx) => updatePurchaseOrder(tx, { storeId, id, version: new Date(version), fields: toFields(data), rate: rate.ok ? rate.rate : null }), TRANSACTION_OPTIONS)
    return { success: true }
  } catch (error) {
    // NO_RATE included: a draft in GHS without a current rate can't be converted
    return writeError(error)
  }
}

// Sends a draft: its lines become incoming stock
export async function markPurchaseOrderedAction(input: z.input<typeof purchaseOrderRefSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = purchaseOrderRefSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, id } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { purchaseOrder: ["update"] }))) return FORBIDDEN

    const order = await prisma.purchaseOrder.findFirst({ where: { id, organizationId: storeId }, select: { currency: true } })
    if (!order) return NOT_FOUND
    const rate = await getRate(order.currency)
    if (!rate.ok) return NO_RATE

    await prisma.$transaction((tx) => markPurchaseOrdered(tx, { storeId, id, orderedById: session.user.id, rate: rate.rate }), TRANSACTION_OPTIONS)
    return { success: true }
  } catch (error) {
    return writeError(error)
  }
}

export async function receivePurchaseOrderAction(input: z.input<typeof receivePurchaseOrderSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = receivePurchaseOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, id, receiptCount, updateBuyPrices, note } = parsed.data
    const items = parsed.data.items.filter((item) => item.quantity > 0)
    if (!items.length) return NOTHING_RECEIVED

    if (!(await hasStorePermission(session.user.id, storeId, { purchaseOrder: ["receive"] }))) return FORBIDDEN
    // Buy prices are part of the listing
    if (updateBuyPrices && !(await hasStorePermission(session.user.id, storeId, { listing: ["update"] }))) return FORBIDDEN

    await prisma.$transaction((tx) => receivePurchaseOrder(tx, { storeId, id, receiptCount, items, updateBuyPrices, note, receivedById: session.user.id }), TRANSACTION_OPTIONS)
    return { success: true }
  } catch (error) {
    return writeError(error)
  }
}

// Cancels an order nothing has arrived on, or closes one that is partly here
export async function cancelPurchaseOrderAction(input: z.input<typeof cancelPurchaseOrderSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = cancelPurchaseOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, id, currentStatus, reason } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { purchaseOrder: ["cancel"] }))) return FORBIDDEN

    await prisma.$transaction((tx) => cancelPurchaseOrder(tx, { storeId, id, from: currentStatus, reason, closedById: session.user.id }), TRANSACTION_OPTIONS)
    return { success: true }
  } catch (error) {
    return writeError(error)
  }
}

export async function deletePurchaseOrderAction(input: z.input<typeof purchaseOrderRefSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = purchaseOrderRefSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, id } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { purchaseOrder: ["cancel"] }))) return FORBIDDEN

    await deleteDraftPurchaseOrder(prisma, { storeId, id })
    return { success: true }
  } catch (error) {
    return writeError(error)
  }
}
