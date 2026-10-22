import "server-only"

import { after } from "next/server"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { InstallationStatus, OrderStatus, PaymentStatus, type PaymentMethod } from "@workspace/db/enums"
import { notifyStoreRefund } from "@workspace/commerce/notifications"
import { sendOrderEmail, statusEmailEvent } from "@workspace/commerce/order-emails"
import { cancelAndRefundOrder, recordOrderReturn, refundOrder, RefundError, type RefundInput, type ReturnInput } from "./order-refunds"
import { cancelInstallation, changeInstallation, InstallationError, type InstallationChange } from "./order-installation"
import { hasBeenPaid, isPaid, nextOrderStatuses } from "@workspace/commerce/order-status"
import { changeOrderStatus, StatusChangedError } from "@workspace/commerce/order-writes"

// The changes the store's and the platform's order pages both make: status, payment, edits to a pending order,
// refunds and returns. The actions check who may make them (store role or system permission) and then call these.

// An error reply, which fits both ActionResponse and DataResponse
export type Failure = Extract<ActionResponse, { success: false }>

export const STATUS_CHANGED: Failure = { success: false, error: "This order's status was changed by someone else. Refresh the page to see it.", code: "STATUS_CHANGED" }
const NOT_PENDING: Failure = { success: false, error: "Only a pending order can be edited, and this one has moved on. Refresh the page.", code: "NOT_PENDING" }

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

export const orderForUpdateSelect = {
  status: true,
  paymentStatus: true,
  shippingMethod: true,
  orderItems: {
    select: {
      organizationId: true,
      quantity: true,
      storeListingId: true,
      storeListingVariantId: true,
      tracksStock: true,
    },
  },
} satisfies Prisma.OrderSelect

export type OrderForUpdate = Prisma.OrderGetPayload<{ select: typeof orderForUpdateSelect }>

export interface StatusUpdate {
  orderId: string
  status: OrderStatus
  // The status the page showed
  currentStatus: OrderStatus
  note: string
  changedById: string
}

// Moves the order on, if the rules allow it from where the page showed it. paidOrder is the reply for cancelling
// a paid order, which needs a refund (Cancel and refund).
export async function updateOrderStatus(order: OrderForUpdate, { orderId, status, currentStatus, note, changedById }: StatusUpdate, paidOrder: Failure): Promise<ActionResponse> {
  if (order.status !== currentStatus) return STATUS_CHANGED

  if (!nextOrderStatuses(currentStatus, order.shippingMethod).includes(status)) {
    return { success: false, error: "The order can't move to that status from where it is.", code: "INVALID_TRANSITION" }
  }
  if (status === OrderStatus.CANCELLED && isPaid(order.paymentStatus)) return paidOrder
  if (status === OrderStatus.COMPLETED && !hasBeenPaid(order.paymentStatus)) {
    return { success: false, error: "Record the payment before completing the order.", code: "UNPAID" }
  }

  try {
    await prisma.$transaction((tx) => changeOrderStatus(tx, { orderId, from: currentStatus, to: status, note: note || null, changedById, items: order.orderItems }), TRANSACTION_OPTIONS)
  } catch (error) {
    if (error instanceof StatusChangedError) return STATUS_CHANGED
    throw error
  }

  // Only once the change is saved: after() also runs when an action fails
  const event = statusEmailEvent(status)
  if (event) after(() => sendOrderEmail(orderId, event, note || null))

  return { success: true }
}

// For payments taken by hand: cash, mobile money or a card terminal
export async function recordOrderPayment(
  order: OrderForUpdate,
  { orderId, paymentMethod, recordedById }: { orderId: string; paymentMethod: PaymentMethod; recordedById: string }
): Promise<ActionResponse> {
  if (order.status === OrderStatus.CANCELLED) return { success: false, error: "This order was cancelled, so it can't be paid.", code: "CANCELLED" }

  // Only an unpaid order, so a payment can't be recorded twice
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] }, status: { not: OrderStatus.CANCELLED } },
    data: { paymentStatus: PaymentStatus.PAID, paymentMethod, paidAt: new Date(), paymentRecordedById: recordedById },
  })
  if (count === 0) return { success: false, error: "This order's payment was already recorded, or it was cancelled. Refresh the page.", code: "PAYMENT_CHANGED" }

  // Only once the payment is saved: after() also runs when an action fails
  after(() => sendOrderEmail(orderId, "PAYMENT_RECEIVED"))

  return { success: true }
}

// Written only while the order is still pending
export async function editPendingOrder(orderId: string, data: Prisma.OrderUpdateManyMutationInput): Promise<ActionResponse> {
  const { count } = await prisma.order.updateMany({ where: { id: orderId, status: OrderStatus.PENDING }, data })
  return count === 0 ? NOT_PENDING : { success: true }
}

// ============================================
// REFUNDS AND RETURNS
// ============================================

// storeId is the store whose staff gave the money back (an owner or admin, through the store's actions), which tells
// the platform; null for the platform's own, including a superAdmin's from a store's pages. The order's emails and that notice go out only once the change has committed.

function refundFailure(error: unknown): Failure {
  if (error instanceof StatusChangedError) return STATUS_CHANGED
  if (error instanceof RefundError || error instanceof InstallationError) return { success: false, error: error.message, code: error.code }
  throw error
}

export async function giveRefund(input: RefundInput & { amountGhs: Prisma.Decimal }, storeId: string | null): Promise<ActionResponse> {
  try {
    await prisma.$transaction((tx) => refundOrder(tx, input), TRANSACTION_OPTIONS)
  } catch (error) {
    return refundFailure(error)
  }

  const amountGhs = input.amountGhs.toFixed(2)
  after(async () => {
    await sendOrderEmail(input.orderId, "REFUNDED", input.reason, { refundAmountGhs: amountGhs })
    if (storeId) await notifyStoreRefund(input.orderId, storeId, { amountGhs, reason: input.reason, givenById: input.refundedById, kind: "refund" })
  })
  return { success: true }
}

// Refunds whatever is left and cancels the order, putting its stock back. For a paid order that hasn't left yet.
export async function cancelWithRefund(input: RefundInput & { currentStatus: OrderStatus }, storeId: string | null): Promise<ActionResponse> {
  let refunded: Prisma.Decimal
  try {
    refunded = (await prisma.$transaction((tx) => cancelAndRefundOrder(tx, input), TRANSACTION_OPTIONS)).refundedGhs
  } catch (error) {
    return refundFailure(error)
  }

  // The customer hears of the cancellation, then of the money coming back
  after(async () => {
    await sendOrderEmail(input.orderId, "CANCELLED", input.reason)
    if (refunded.gt(0)) {
      const amountGhs = refunded.toFixed(2)
      await sendOrderEmail(input.orderId, "REFUNDED", input.reason, { refundAmountGhs: amountGhs })
      if (storeId) await notifyStoreRefund(input.orderId, storeId, { amountGhs, reason: input.reason, givenById: input.refundedById, kind: "cancel" })
    }
  })
  return { success: true }
}

// Items brought back after delivery: restocks the ones chosen and refunds the amount given, if any. One customer email
// for both; the platform hears only when money went back.
export async function recordReturn(input: ReturnInput, storeId: string | null): Promise<ActionResponse> {
  let result: Awaited<ReturnType<typeof recordOrderReturn>>
  try {
    result = await prisma.$transaction((tx) => recordOrderReturn(tx, input), TRANSACTION_OPTIONS)
  } catch (error) {
    return refundFailure(error)
  }

  const amountGhs = result.refundedGhs.gt(0) ? result.refundedGhs.toFixed(2) : null
  after(async () => {
    await sendOrderEmail(input.orderId, "RETURNED", input.reason, { refundAmountGhs: amountGhs, returnedItems: result.items })
    if (storeId && amountGhs) await notifyStoreRefund(input.orderId, storeId, { amountGhs, reason: input.reason, givenById: input.recordedById, kind: "return" })
  })
  return { success: true }
}

// ============================================
// INSTALLATION (the platform's staff only: its installers do the work)
// ============================================

// Books the installers for a day, or marks it done. A booking emails the customer the day and the note.
export async function updateInstallation(change: InstallationChange): Promise<ActionResponse> {
  try {
    await prisma.$transaction((tx) => changeInstallation(tx, change), TRANSACTION_OPTIONS)
  } catch (error) {
    return refundFailure(error)
  }

  if (change.to === InstallationStatus.BOOKED) after(() => sendOrderEmail(change.orderId, "INSTALLATION_BOOKED", change.note))
  return { success: true }
}

// Cancels the installation, refunding the amount given. The customer hears of the refund.
export async function cancelOrderInstallation(input: RefundInput & { from: InstallationStatus; amountGhs: Prisma.Decimal }): Promise<ActionResponse> {
  try {
    await prisma.$transaction((tx) => cancelInstallation(tx, input), TRANSACTION_OPTIONS)
  } catch (error) {
    return refundFailure(error)
  }

  if (input.amountGhs.gt(0)) {
    const amountGhs = input.amountGhs.toFixed(2)
    after(() => sendOrderEmail(input.orderId, "REFUNDED", input.reason, { refundAmountGhs: amountGhs }))
  }
  return { success: true }
}

// The return form's values (amounts as numbers, every line with 0 for the ones not coming back) as recordReturn takes them
export function toReturnInput(
  values: { orderId: string; refundedGhs: string; returnCount: number; items: ReturnInput["items"]; reason: string; refundAmountGhs: number; method: PaymentMethod },
  recordedById: string
): ReturnInput {
  const amountGhs = new Prisma.Decimal(values.refundAmountGhs.toFixed(2))
  return {
    orderId: values.orderId,
    refundedGhs: new Prisma.Decimal(values.refundedGhs),
    returnCount: values.returnCount,
    items: values.items.filter((item) => item.quantity > 0),
    reason: values.reason,
    refund: amountGhs.gt(0) ? { amountGhs, method: values.method } : null,
    recordedById,
  }
}
