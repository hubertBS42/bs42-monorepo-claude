import "server-only"

import { after } from "next/server"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { OrderStatus, PaymentStatus, type PaymentMethod } from "@workspace/db/enums"
import { sendOrderEmail, statusEmailEvent } from "./order-emails"
import { hasBeenPaid, isPaid, nextOrderStatuses } from "./order-status"
import { changeOrderStatus, StatusChangedError } from "./store-order-writes"

// The changes the store's and the platform's order pages both make: status, payment and edits to a pending order.
// The actions check who may make them (store role or system permission) and then call these.

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
      storeListing: { select: { trackInventory: true } },
      storeListingVariant: { select: { trackInventory: true } },
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
// a paid order, which needs a refund: the store asks the platform, the platform uses Cancel and refund.
export async function updateOrderStatus(order: OrderForUpdate, { orderId, status, currentStatus, note, changedById }: StatusUpdate, paidOrder: Failure): Promise<ActionResponse> {
  if (order.status !== currentStatus) return STATUS_CHANGED

  if (!nextOrderStatuses(currentStatus, order.shippingMethod).includes(status)) {
    return { success: false, error: "The order can't move to that status from where it is.", code: "INVALID_TRANSITION" }
  }
  if (status === OrderStatus.CANCELLED && isPaid(order.paymentStatus)) return paidOrder
  if (status === OrderStatus.COMPLETED && !hasBeenPaid(order.paymentStatus)) {
    return { success: false, error: "Record the payment before completing the order.", code: "UNPAID" }
  }

  const items = order.orderItems.map((item) => ({
    quantity: item.quantity,
    storeListingId: item.storeListingId,
    storeListingVariantId: item.storeListingVariantId,
    listingTracks: item.storeListing.trackInventory,
    variantTracks: item.storeListingVariant?.trackInventory ?? false,
  }))
  try {
    await prisma.$transaction((tx) => changeOrderStatus(tx, { orderId, from: currentStatus, to: status, note: note || null, changedById, items }), TRANSACTION_OPTIONS)
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
