import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus, PaymentStatus, StockMovementReason, type PaymentMethod } from "@workspace/db/enums"
import { canBeReturned, hasBeenPaid, isPaid, nextOrderStatuses } from "@workspace/commerce/order-status"
import { addStock } from "@workspace/commerce/stock-movements"
import { changeOrderStatus, StatusChangedError } from "@workspace/commerce/order-writes"

// Refunds, by the platform on any order or by a store's owners and admins on its own: giving money back on a paid order, cancelling a paid order with a refund of whatever is
// left, and recording items a customer brought back. In their own module (like listing-sync.ts) so they can be
// tested against the database without a session.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export type RefundErrorCode = "NOT_FOUND" | "NOT_PAID" | "REFUNDS_CHANGED" | "TOO_MUCH" | "NOT_CANCELLABLE" | "NOT_RETURNABLE" | "RETURNS_CHANGED" | "TOO_MANY"

export class RefundError extends Error {
  readonly code: RefundErrorCode

  constructor(code: RefundErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export interface RefundInput {
  orderId: string
  // What the page showed as refunded so far, so two people can't both refund the same money
  refundedGhs: Prisma.Decimal
  method: PaymentMethod
  reason: string
  refundedById: string
}

// Locks the order until the transaction ends, so refunds and status changes on it wait their turn, and returns what
// the refund checks need
async function lockOrderForRefund(tx: Tx, orderId: string, refundedGhs: Prisma.Decimal) {
  await tx.$queryRaw`SELECT 1 FROM "order" WHERE "id" = ${orderId}::uuid FOR UPDATE`

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      paymentStatus: true,
      shippingMethod: true,
      totalGhs: true,
      refunds: { select: { amountGhs: true } },
      returns: { select: { id: true } },
      orderItems: {
        select: {
          id: true,
          productName: true,
          variantDescription: true,
          totalPriceGhs: true,
          discountGhs: true,
          taxGhs: true,
          returns: { select: { quantity: true } },
          quantity: true,
          storeListingId: true,
          storeListingVariantId: true,
          tracksStock: true,
        },
      },
    },
  })
  if (!order) throw new RefundError("NOT_FOUND", "Order not found.")

  const refunded = order.refunds.reduce((sum, refund) => sum.plus(refund.amountGhs), new Prisma.Decimal(0))
  if (!refunded.equals(refundedGhs)) {
    throw new RefundError("REFUNDS_CHANGED", "Someone else refunded this order since the page loaded. Refresh the page to see it.")
  }

  return { order, refunded, remaining: order.totalGhs.minus(refunded) }
}

async function writeRefund(tx: Tx, input: RefundInput, amountGhs: Prisma.Decimal, total: Prisma.Decimal, refundedAfter: Prisma.Decimal) {
  const refund = await tx.orderRefund.create({
    data: { orderId: input.orderId, amountGhs, method: input.method, reason: input.reason, refundedById: input.refundedById },
    select: { id: true },
  })
  const paymentStatus = refundedAfter.gte(total) ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED
  await tx.order.update({ where: { id: input.orderId }, data: { paymentStatus } })
  return { paymentStatus, refundId: refund.id }
}

// Gives back part or all of what's left on a paid order. The order's status doesn't change: a refund is money only,
// and stock comes back only when an order is cancelled.
export async function refundOrder(tx: Tx, input: RefundInput & { amountGhs: Prisma.Decimal }) {
  const { order, refunded, remaining } = await lockOrderForRefund(tx, input.orderId, input.refundedGhs)
  if (!isPaid(order.paymentStatus)) throw new RefundError("NOT_PAID", "Only a paid order can be refunded.")
  if (input.amountGhs.gt(remaining)) {
    throw new RefundError("TOO_MUCH", `Only GHS ${remaining.toFixed(2)} of this order is left to refund.`)
  }

  const { paymentStatus } = await writeRefund(tx, input, input.amountGhs, order.totalGhs, refunded.plus(input.amountGhs))
  return { paymentStatus }
}

// Refunds whatever is left and cancels the order, which puts its reserved stock back. For a paid order that hasn't
// left yet; one that was delivered can still be refunded, but not cancelled.
export async function cancelAndRefundOrder(tx: Tx, input: RefundInput & { currentStatus: OrderStatus }) {
  const { order, refunded, remaining } = await lockOrderForRefund(tx, input.orderId, input.refundedGhs)
  if (order.status !== input.currentStatus) throw new StatusChangedError()
  if (!nextOrderStatuses(order.status, order.shippingMethod).includes(OrderStatus.CANCELLED)) {
    throw new RefundError("NOT_CANCELLABLE", "This order has left the store, so it can't be cancelled. Refund it instead.")
  }
  if (!isPaid(order.paymentStatus)) throw new RefundError("NOT_PAID", "This order hasn't been paid, so cancel it without a refund.")

  // A partly refunded order has some left; the rest goes back now
  if (remaining.gt(0)) await writeRefund(tx, input, remaining, order.totalGhs, refunded.plus(remaining))

  await changeOrderStatus(tx, {
    orderId: input.orderId,
    from: order.status,
    to: OrderStatus.CANCELLED,
    note: input.reason,
    changedById: input.refundedById,
    items: order.orderItems,
  })

  return { refundedGhs: remaining }
}

export interface ReturnInput {
  orderId: string
  // What the page showed: the refunded total and how many returns the order had, so the same items can't come back twice
  refundedGhs: Prisma.Decimal
  returnCount: number
  // One entry per line coming back. restock puts the units back on sale, where the line's listing tracks stock.
  items: { orderItemId: string; quantity: number; restock: boolean }[]
  reason: string
  // Null, or a zero amount, when no money goes back (an exchange, or nothing was paid)
  refund: { amountGhs: Prisma.Decimal; method: PaymentMethod } | null
  recordedById: string
}

// How many of a line's units have come back so far
export function returnedSoFar(item: { returns: { quantity: number }[] }) {
  return item.returns.reduce((sum, row) => sum + row.quantity, 0)
}

// Records items brought back after the order reached the customer: puts the restocked ones back on sale and, when
// there's an amount, refunds it (up to what's left on the order). The order's status doesn't change. Returns the
// amount refunded and, for the customer email, what came back.
export async function recordOrderReturn(tx: Tx, input: ReturnInput) {
  const { order, refunded, remaining } = await lockOrderForRefund(tx, input.orderId, input.refundedGhs)
  if (order.returns.length !== input.returnCount) {
    throw new RefundError("RETURNS_CHANGED", "Someone else recorded a return on this order since the page loaded. Refresh the page to see it.")
  }
  if (!canBeReturned(order.status)) throw new RefundError("NOT_RETURNABLE", "Items can only be returned once the order has been delivered. Cancel it instead.")
  // Otherwise a later "Record payment" would count the returned items as paid for
  if (!hasBeenPaid(order.paymentStatus)) throw new RefundError("NOT_PAID", "Record the payment before recording a return, then refund what came back.")

  const lines = new Map(order.orderItems.map((item) => [item.id, item]))
  const returning = input.items.map((entry) => {
    const line = lines.get(entry.orderItemId)
    if (!line) throw new RefundError("NOT_FOUND", "An item being returned isn't on this order.")
    const left = line.quantity - returnedSoFar(line)
    if (entry.quantity > left) {
      throw new RefundError("TOO_MANY", `Only ${left} of ${line.productName}${line.variantDescription ? ` (${line.variantDescription})` : ""} can still be returned.`)
    }
    // Stock goes back only for a line whose sale took it, as a cancellation does
    return { line, quantity: entry.quantity, restocked: entry.restock && line.tracksStock }
  })

  const amount = input.refund?.amountGhs ?? new Prisma.Decimal(0)
  let refundId: string | null = null
  if (amount.gt(0)) {
    if (!isPaid(order.paymentStatus)) throw new RefundError("NOT_PAID", "Nothing is left to refund on this order, so record the return without a refund.")
    if (amount.gt(remaining)) throw new RefundError("TOO_MUCH", `Only GHS ${remaining.toFixed(2)} of this order is left to refund.`)
    const refund = { orderId: input.orderId, refundedGhs: input.refundedGhs, method: input.refund!.method, reason: input.reason, refundedById: input.recordedById }
    refundId = (await writeRefund(tx, refund, amount, order.totalGhs, refunded.plus(amount))).refundId
  }

  const orderReturn = await tx.orderReturn.create({
    data: {
      orderId: input.orderId,
      reason: input.reason,
      refundId,
      recordedById: input.recordedById,
      items: { create: returning.map(({ line, quantity, restocked }) => ({ orderItemId: line.id, quantity, restocked })) },
    },
    select: { id: true },
  })

  for (const { line, quantity, restocked } of returning) {
    if (!restocked) continue
    await addStock(tx, { listingId: line.storeListingId, listingVariantId: line.storeListingVariantId }, quantity, {
      reason: StockMovementReason.RETURN,
      createdById: input.recordedById,
      orderId: input.orderId,
      orderReturnId: orderReturn.id,
    })
  }

  return {
    refundedGhs: amount,
    items: returning.map(({ line, quantity }) => ({ productName: line.productName, variantDescription: line.variantDescription, quantity })),
  }
}
