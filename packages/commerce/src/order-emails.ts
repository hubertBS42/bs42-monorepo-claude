import "server-only"

import { authURLs } from "@workspace/auth/constants"
import { prisma, readAppSettings, resolveStoreName } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus, ShippingMethod } from "@workspace/db/enums"
import {
  sendOrderCancelledEmail,
  sendOrderConfirmationEmail,
  sendOrderConfirmedEmail,
  sendOrderDeliveredEmail,
  sendOrderInstallationBookedEmail,
  sendOrderPaymentReceivedEmail,
  sendOrderRefundedEmail,
  sendOrderReturnedEmail,
  sendOrderReviewRequestEmail,
  sendOrderShippedEmail,
  sendOrderUnpaidCancelledEmail,
  type BaseOrderEmail,
  type OrderConfirmationEmail,
  type ReturnedItem,
  type ReviewRequestItem,
} from "@workspace/email"
import { formatDate } from "@workspace/utils/date"
import { hasBeenPaid, PAYMENT_METHOD_LABELS } from "./order-status"
import { unreviewedOrderProducts } from "./reviews"

// Customer emails for orders. Actions schedule them with after(), once the order is saved, so a slow or failed
// email never holds up or fails the change.

// UNPAID_CANCELLED: a storefront order cancelled by the unpaid-order job, which wasn't charged. COMPLETED asks for
// reviews of what the customer hasn't reviewed yet. INSTALLATION_BOOKED: the day the installers come, with staff's note.
export type OrderEmailEvent =
  | "CREATED"
  | "INSTALLATION_BOOKED"
  | "PAYMENT_RECEIVED"
  | "REFUNDED"
  | "RETURNED"
  | "UNPAID_CANCELLED"
  | typeof OrderStatus.CONFIRMED
  | typeof OrderStatus.SHIPPED
  | typeof OrderStatus.DELIVERED
  | typeof OrderStatus.COMPLETED
  | typeof OrderStatus.CANCELLED

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
  installationGhs: true,
  installationDate: true,
  taxGhs: true,
  totalGhs: true,
  discountType: true,
  discountValue: true,
  discountAmountGhs: true,
  discountReason: true,
  user: { select: { getOrderEmails: true } },
  orderItems: { orderBy: { id: "asc" }, select: { productName: true, variantDescription: true, quantity: true, totalPriceGhs: true, installationUnitGhs: true } },
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
  | { kind: "UNPAID_CANCELLED"; data: BaseOrderEmail & { paymentMinutes: number; url: string } }
  | { kind: "REVIEW_REQUEST"; data: BaseOrderEmail & { items: ReviewRequestItem[] } }
  | { kind: "INSTALLATION_BOOKED"; data: BaseOrderEmail & { date: string; note: string | null } }

// The stored amounts as they are, for display: nothing here recalculates them
const amount = (value: Prisma.Decimal) => Number(value.toFixed(2))

// What a refund or a return adds to its email: the amount given back, and for a return what came back. An unpaid
// order's cancellation adds the order page's address and how long there was to pay. A completed order adds the
// products to ask for reviews of.
export interface OrderEmailExtra {
  refundAmountGhs?: string | null
  returnedItems?: ReturnedItem[]
  orderUrl?: string
  paymentMinutes?: number
  reviewItems?: ReviewRequestItem[]
}

// Which email an event sends, or null when it sends none. Pure, so it can be tested without sending anything.
// A refund's or a return's note is its reason.
export function buildOrderEmail(
  order: OrderForEmail,
  event: OrderEmailEvent,
  note: string | null,
  brand: { appName: string; logoUrl: string | null },
  { refundAmountGhs = null, returnedItems = [], orderUrl, paymentMinutes, reviewItems = [] }: OrderEmailExtra = {}
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
          items: order.orderItems.map((item) => ({
            productName: item.productName,
            variantDescription: item.variantDescription,
            quantity: item.quantity,
            totalPriceGhs: amount(item.totalPriceGhs),
            installed: !!item.installationUnitGhs,
          })),
          subtotalGhs: amount(order.subtotalGhs),
          shippingGhs: amount(order.shippingGhs),
          installationGhs: amount(order.installationGhs),
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
    case "UNPAID_CANCELLED":
      return orderUrl && paymentMinutes ? { kind: "UNPAID_CANCELLED", data: { ...base, paymentMinutes, url: orderUrl } } : null
    case "INSTALLATION_BOOKED":
      // A @db.Date comes back as midnight UTC, which formatDate's zone (Accra's) reads as the same day
      return order.installationDate ? { kind: "INSTALLATION_BOOKED", data: { ...base, date: formatDate(order.installationDate, "EEEE d MMMM"), note } } : null
    case OrderStatus.COMPLETED:
      // Nothing left to review, nothing to ask
      return reviewItems.length > 0 ? { kind: "REVIEW_REQUEST", data: { ...base, items: reviewItems } } : null
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
    case "UNPAID_CANCELLED":
      return sendOrderUnpaidCancelledEmail(email.data)
    case "REVIEW_REQUEST":
      return sendOrderReviewRequestEmail(email.data)
    case "INSTALLATION_BOOKED":
      return sendOrderInstallationBookedEmail(email.data)
  }
}

// The storefront's page for writing a product's review
export const reviewUrl = (productSlug: string) => new URL(`/account/reviews/${productSlug}`, authURLs.store).toString()

// Sends the event's email from the saved order. Never throws: it runs after the response, where nothing could catch it.
export async function sendOrderEmail(orderId: string, event: OrderEmailEvent, note: string | null = null, extra: OrderEmailExtra = {}) {
  try {
    const [order, settings] = await Promise.all([prisma.order.findUnique({ where: { id: orderId }, select: orderEmailSelect }), readAppSettings()])
    if (!order) return

    // The review links go through sign-in: only buyers review
    if (event === OrderStatus.COMPLETED) {
      const products = await unreviewedOrderProducts(prisma, orderId)
      extra = { ...extra, reviewItems: products.map((product) => ({ productName: product.name, imageUrl: product.image, reviewUrl: reviewUrl(product.slug) })) }
    }

    // Customer emails carry the storefront's name and logo, not the console's
    const email = buildOrderEmail(order, event, note, { appName: resolveStoreName(settings), logoUrl: settings.logoUrl }, extra)
    if (email) await deliver(email)
  } catch (error) {
    console.error(`Could not send the ${event} email for order ${orderId}:`, error)
  }
}

// The email a status change sends, if any
export function statusEmailEvent(status: OrderStatus): OrderEmailEvent | null {
  return status === OrderStatus.CONFIRMED || status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED || status === OrderStatus.COMPLETED || status === OrderStatus.CANCELLED ? status : null
}
