import "server-only"

import { prisma, readAppSettings, resolveStoreName } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus, ShippingMethod } from "@workspace/db/enums"
import {
  sendOrderCancelledEmail,
  sendOrderConfirmationEmail,
  sendOrderConfirmedEmail,
  sendOrderDeliveredEmail,
  sendOrderPaymentReceivedEmail,
  sendOrderRefundedEmail,
  sendOrderReturnedEmail,
  sendOrderShippedEmail,
  type BaseOrderEmail,
  type OrderConfirmationEmail,
  type ReturnedItem,
} from "@workspace/email"
import { hasBeenPaid, PAYMENT_METHOD_LABELS } from "./order-status"

// Customer emails for orders. Actions schedule them with after(), once the order is saved, so a slow or failed
// email never holds up or fails the change.

export type OrderEmailEvent =
  "CREATED" | "PAYMENT_RECEIVED" | "REFUNDED" | "RETURNED" | typeof OrderStatus.CONFIRMED | typeof OrderStatus.SHIPPED | typeof OrderStatus.DELIVERED | typeof OrderStatus.CANCELLED

const orderEmailSelect = {
  reference: true,
  customerName: true,
  customerEmail: true,
  shippingMethod: true,
  shippingLine1: true,
  shippingLine2: true,
  shippingTown: true,
  shippingRegion: true,
  paymentMethod: true,
  paymentStatus: true,
  subtotalGhs: true,
  shippingGhs: true,
  taxGhs: true,
  totalGhs: true,
  discountType: true,
  discountValue: true,
  discountAmountGhs: true,
  discountReason: true,
  user: { select: { getOrderEmails: true } },
  orderItems: { orderBy: { id: "asc" }, select: { productName: true, variantDescription: true, quantity: true, totalPriceGhs: true } },
} satisfies Prisma.OrderSelect

export type OrderForEmail = Prisma.OrderGetPayload<{ select: typeof orderEmailSelect }>

export type OrderEmail =
  | { kind: "CREATED"; data: OrderConfirmationEmail }
  | { kind: "CONFIRMED" | "DELIVERED"; data: BaseOrderEmail & { note: string | null } }
  | { kind: "PAYMENT_RECEIVED"; data: BaseOrderEmail & { amountGhs: number; paymentMethod: string } }
  | { kind: "REFUNDED"; data: BaseOrderEmail & { refundReason: string; refundAmountGhs: number } }
  | { kind: "RETURNED"; data: BaseOrderEmail & { items: ReturnedItem[]; returnReason: string; refundAmountGhs: number | null } }
  | { kind: "SHIPPED"; data: BaseOrderEmail & { shippingAddress: string; note: string | null } }
  | { kind: "CANCELLED"; data: BaseOrderEmail & { cancellationReason: string; totalGhs: number } }

// The stored amounts as they are, for display: nothing here recalculates them
const amount = (value: Prisma.Decimal) => Number(value.toFixed(2))

// What a refund or a return adds to its email: the amount given back, and for a return what came back
export interface OrderEmailExtra {
  refundAmountGhs?: string | null
  returnedItems?: ReturnedItem[]
}

// Which email an event sends, or null when it sends none. Pure, so it can be tested without sending anything.
// A refund's or a return's note is its reason.
export function buildOrderEmail(
  order: OrderForEmail,
  event: OrderEmailEvent,
  note: string | null,
  brand: { appName: string; logoUrl: string | null },
  { refundAmountGhs = null, returnedItems = [] }: OrderEmailExtra = {}
): OrderEmail | null {
  // Walk-in customers may give no email; an account can turn order emails off
  if (!order.customerEmail || order.user?.getOrderEmails === false) return null

  const base: BaseOrderEmail = { to: order.customerEmail, customerName: order.customerName, reference: order.reference, appName: brand.appName, logoUrl: brand.logoUrl }
  const isDelivery = order.shippingMethod === ShippingMethod.DELIVERY
  const address = [order.shippingLine1, order.shippingLine2, order.shippingTown, order.shippingRegion].filter(Boolean).join(", ")

  switch (event) {
    case "CREATED":
      return {
        kind: "CREATED",
        data: {
          ...base,
          items: order.orderItems.map((item) => ({ productName: item.productName, variantDescription: item.variantDescription, quantity: item.quantity, totalPriceGhs: amount(item.totalPriceGhs) })),
          subtotalGhs: amount(order.subtotalGhs),
          shippingGhs: amount(order.shippingGhs),
          taxGhs: amount(order.taxGhs),
          // A zero discount isn't one
          discountAmountGhs: order.discountAmountGhs && order.discountAmountGhs.gt(0) ? amount(order.discountAmountGhs) : null,
          discountType: order.discountType,
          discountValue: order.discountValue ? amount(order.discountValue) : null,
          discountReason: order.discountReason,
          totalGhs: amount(order.totalGhs),
          shippingMethod: order.shippingMethod,
          shippingAddress: isDelivery ? address : null,
          paymentMethod: PAYMENT_METHOD_LABELS[order.paymentMethod],
          paid: hasBeenPaid(order.paymentStatus),
        },
      }
    case "REFUNDED":
      return refundAmountGhs ? { kind: "REFUNDED", data: { ...base, refundReason: note || "No reason was given.", refundAmountGhs: Number(refundAmountGhs) } } : null
    case "RETURNED":
      // One email for the return and its refund, if any
      return returnedItems.length > 0
        ? { kind: "RETURNED", data: { ...base, items: returnedItems, returnReason: note || "No reason was given.", refundAmountGhs: refundAmountGhs ? Number(refundAmountGhs) : null } }
        : null
    case "PAYMENT_RECEIVED":
      return { kind: "PAYMENT_RECEIVED", data: { ...base, amountGhs: amount(order.totalGhs), paymentMethod: PAYMENT_METHOD_LABELS[order.paymentMethod] } }
    case OrderStatus.CONFIRMED:
      return { kind: "CONFIRMED", data: { ...base, note } }
    case OrderStatus.SHIPPED:
      return isDelivery ? { kind: "SHIPPED", data: { ...base, shippingAddress: address, note } } : null
    case OrderStatus.DELIVERED:
      // Someone who collected the order in person doesn't need telling it was delivered
      return isDelivery ? { kind: "DELIVERED", data: { ...base, note } } : null
    case OrderStatus.CANCELLED:
      return { kind: "CANCELLED", data: { ...base, cancellationReason: note || "No reason was given.", totalGhs: amount(order.totalGhs) } }
  }
}

function deliver(email: OrderEmail) {
  switch (email.kind) {
    case "CREATED":
      return sendOrderConfirmationEmail(email.data)
    case "PAYMENT_RECEIVED":
      return sendOrderPaymentReceivedEmail(email.data)
    case "REFUNDED":
      return sendOrderRefundedEmail(email.data)
    case "RETURNED":
      return sendOrderReturnedEmail(email.data)
    case "CONFIRMED":
      return sendOrderConfirmedEmail(email.data)
    case "SHIPPED":
      return sendOrderShippedEmail(email.data)
    case "DELIVERED":
      return sendOrderDeliveredEmail(email.data)
    case "CANCELLED":
      return sendOrderCancelledEmail(email.data)
  }
}

// Sends the event's email from the saved order. Never throws: it runs after the response, where nothing could catch it.
export async function sendOrderEmail(orderId: string, event: OrderEmailEvent, note: string | null = null, extra: OrderEmailExtra = {}) {
  try {
    const [order, settings] = await Promise.all([prisma.order.findUnique({ where: { id: orderId }, select: orderEmailSelect }), readAppSettings()])
    if (!order) return

    // Customer emails carry the storefront's name and logo, not the console's
    const email = buildOrderEmail(order, event, note, { appName: resolveStoreName(settings), logoUrl: settings.logoUrl }, extra)
    if (email) await deliver(email)
  } catch (error) {
    console.error(`Could not send the ${event} email for order ${orderId}:`, error)
  }
}

// The email a status change sends, if any
export function statusEmailEvent(status: OrderStatus): OrderEmailEvent | null {
  return status === OrderStatus.CONFIRMED || status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED ? status : null
}
