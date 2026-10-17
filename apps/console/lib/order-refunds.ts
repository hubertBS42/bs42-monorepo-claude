import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus, PaymentStatus, type PaymentMethod } from "@workspace/db/enums"
import { isPaid, nextOrderStatuses } from "./order-status"
import { changeOrderStatus, StatusChangedError } from "./store-order-writes"

// The platform's refunds: giving money back on a paid order, and cancelling a paid order with a refund of whatever
// is left. In their own module (like store-order-writes.ts) so they can be tested against the database without a session.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export type RefundErrorCode = "NOT_FOUND" | "NOT_PAID" | "REFUNDS_CHANGED" | "TOO_MUCH" | "NOT_CANCELLABLE"

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
      orderItems: {
        select: {
          quantity: true,
          storeListingId: true,
          storeListingVariantId: true,
          storeListing: { select: { trackInventory: true } },
          storeListingVariant: { select: { trackInventory: true } },
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
  await tx.orderRefund.create({
    data: { orderId: input.orderId, amountGhs, method: input.method, reason: input.reason, refundedById: input.refundedById },
  })
  const paymentStatus = refundedAfter.gte(total) ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED
  await tx.order.update({ where: { id: input.orderId }, data: { paymentStatus } })
  return paymentStatus
}

// Gives back part or all of what's left on a paid order. The order's status doesn't change: a refund is money only,
// and stock comes back only when an order is cancelled.
export async function refundOrder(tx: Tx, input: RefundInput & { amountGhs: Prisma.Decimal }) {
  const { order, refunded, remaining } = await lockOrderForRefund(tx, input.orderId, input.refundedGhs)
  if (!isPaid(order.paymentStatus)) throw new RefundError("NOT_PAID", "Only a paid order can be refunded.")
  if (input.amountGhs.gt(remaining)) {
    throw new RefundError("TOO_MUCH", `Only GHS ${remaining.toFixed(2)} of this order is left to refund.`)
  }

  const paymentStatus = await writeRefund(tx, input, input.amountGhs, order.totalGhs, refunded.plus(input.amountGhs))
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
    items: order.orderItems.map((item) => ({
      quantity: item.quantity,
      storeListingId: item.storeListingId,
      storeListingVariantId: item.storeListingVariantId,
      listingTracks: item.storeListing.trackInventory,
      variantTracks: item.storeListingVariant?.trackInventory ?? false,
    })),
  })

  return { refundedGhs: remaining }
}
