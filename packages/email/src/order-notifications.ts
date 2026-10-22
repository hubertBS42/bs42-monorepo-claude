import { sendEmail } from "./mailer.js"
import { OrderConfirmation } from "./templates/order/order-confirmation.js"
import { OrderConfirmed } from "./templates/order/order-confirmed.js"
import { OrderShipped } from "./templates/order/order-shipped.js"
import { OrderDelivered } from "./templates/order/order-delivered.js"
import { OrderCancelled } from "./templates/order/order-cancelled.js"
import { OrderUnpaidCancelled } from "./templates/order/order-unpaid-cancelled.js"
import { OrderRefunded } from "./templates/order/order-refunded.js"
import { OrderPaymentReceived } from "./templates/order/order-payment-received.js"
import { OrderReturned, type ReturnedItem } from "./templates/order/order-returned.js"
import { OrderReviewRequest, type ReviewRequestItem } from "./templates/order/order-review-request.js"
import type { OrderSummaryItem } from "./templates/order/components/order-summary.js"

export interface BaseOrderEmail {
  // Order.customerEmail is optional (walk-in POS customers), so callers skip these emails when there is none
  to: string
  customerName: string
  reference: string
  appName: string
  logoUrl?: string | null
}

export interface OrderConfirmationEmail extends BaseOrderEmail {
  // Pass the stored GHS amounts as they are; nothing here converts or recalculates them
  items: OrderSummaryItem[]
  subtotalGhs: number
  shippingGhs: number
  taxGhs: number
  discountAmountGhs: number | null
  discountType: string | null
  discountValue: number | null
  discountReason: string | null
  totalGhs: number
  shippingMethod: string
  shippingAddress?: string | null
  paymentMethod: string
  // Paid when the order was placed (online), rather than due on delivery
  paid?: boolean
}

export async function sendOrderConfirmationEmail(data: OrderConfirmationEmail) {
  return sendEmail({
    to: data.to,
    fromName: data.appName,
    subject: `Order Confirmation — ${data.reference}`,
    reactTemplate: OrderConfirmation({
      customerName: data.customerName,
      reference: data.reference,
      items: data.items,
      subtotalGhs: data.subtotalGhs,
      shippingGhs: data.shippingGhs,
      taxGhs: data.taxGhs,
      discountAmountGhs: data.discountAmountGhs,
      discountType: data.discountType,
      discountValue: data.discountValue,
      discountReason: data.discountReason,
      totalGhs: data.totalGhs,
      shippingMethod: data.shippingMethod,
      shippingAddress: data.shippingAddress,
      paymentMethod: data.paymentMethod,
      paid: data.paid,
      appName: data.appName,
      logoUrl: data.logoUrl,
    }),
  })
}

export async function sendOrderConfirmedEmail(data: BaseOrderEmail & { note?: string | null }) {
  return sendEmail({
    to: data.to,
    fromName: data.appName,
    subject: `Order Confirmed — ${data.reference}`,
    reactTemplate: OrderConfirmed({
      customerName: data.customerName,
      reference: data.reference,
      note: data.note,
      appName: data.appName,
      logoUrl: data.logoUrl,
    }),
  })
}

// amountGhs is the order total that was paid; paymentMethod is a label for display ("Mobile money")
export async function sendOrderPaymentReceivedEmail(data: BaseOrderEmail & { amountGhs: number; paymentMethod: string }) {
  return sendEmail({
    to: data.to,
    fromName: data.appName,
    subject: `Payment Received — ${data.reference}`,
    reactTemplate: OrderPaymentReceived({
      customerName: data.customerName,
      reference: data.reference,
      amountGhs: data.amountGhs,
      paymentMethod: data.paymentMethod,
      appName: data.appName,
      logoUrl: data.logoUrl,
    }),
  })
}

export async function sendOrderShippedEmail(data: BaseOrderEmail & { shippingAddress: string; note?: string | null }) {
  return sendEmail({
    to: data.to,
    fromName: data.appName,
    subject: `Your Order is On Its Way — ${data.reference}`,
    reactTemplate: OrderShipped({
      customerName: data.customerName,
      reference: data.reference,
      shippingAddress: data.shippingAddress,
      note: data.note,
      appName: data.appName,
      logoUrl: data.logoUrl,
    }),
  })
}

export async function sendOrderDeliveredEmail(data: BaseOrderEmail & { note?: string | null }) {
  return sendEmail({
    to: data.to,
    fromName: data.appName,
    subject: `Order Delivered — ${data.reference}`,
    reactTemplate: OrderDelivered({
      customerName: data.customerName,
      reference: data.reference,
      note: data.note,
      appName: data.appName,
      logoUrl: data.logoUrl,
    }),
  })
}

export async function sendOrderUnpaidCancelledEmail(data: BaseOrderEmail & { paymentMinutes: number; url: string }) {
  return sendEmail({
    to: data.to,
    fromName: data.appName,
    subject: `Order Not Completed — ${data.reference}`,
    reactTemplate: OrderUnpaidCancelled({
      customerName: data.customerName,
      reference: data.reference,
      paymentMinutes: data.paymentMinutes,
      url: data.url,
      appName: data.appName,
      logoUrl: data.logoUrl,
    }),
  })
}

export async function sendOrderReviewRequestEmail(data: BaseOrderEmail & { items: ReviewRequestItem[] }) {
  return sendEmail({
    to: data.to,
    fromName: data.appName,
    subject: `How was your order? — ${data.reference}`,
    reactTemplate: OrderReviewRequest({
      customerName: data.customerName,
      reference: data.reference,
      items: data.items,
      appName: data.appName,
      logoUrl: data.logoUrl,
    }),
  })
}

export async function sendOrderCancelledEmail(data: BaseOrderEmail & { cancellationReason: string; totalGhs: number }) {
  return sendEmail({
    to: data.to,
    fromName: data.appName,
    subject: `Order Cancelled — ${data.reference}`,
    reactTemplate: OrderCancelled({
      customerName: data.customerName,
      reference: data.reference,
      cancellationReason: data.cancellationReason,
      totalGhs: data.totalGhs,
      appName: data.appName,
      logoUrl: data.logoUrl,
    }),
  })
}

// refundAmountGhs is what was given back, which is less than the order total for a partial refund
export async function sendOrderRefundedEmail(data: BaseOrderEmail & { refundReason: string; refundAmountGhs: number }) {
  return sendEmail({
    to: data.to,
    fromName: data.appName,
    subject: `Order Refunded — ${data.reference}`,
    reactTemplate: OrderRefunded({
      customerName: data.customerName,
      reference: data.reference,
      refundReason: data.refundReason,
      refundAmountGhs: data.refundAmountGhs,
      appName: data.appName,
      logoUrl: data.logoUrl,
    }),
  })
}

// Items the customer brought back, with what was refunded for them (null when nothing was)
export async function sendOrderReturnedEmail(data: BaseOrderEmail & { items: ReturnedItem[]; returnReason: string; refundAmountGhs: number | null }) {
  return sendEmail({
    to: data.to,
    fromName: data.appName,
    subject: `Return Received — ${data.reference}`,
    reactTemplate: OrderReturned({
      customerName: data.customerName,
      reference: data.reference,
      items: data.items,
      returnReason: data.returnReason,
      refundAmountGhs: data.refundAmountGhs,
      appName: data.appName,
      logoUrl: data.logoUrl,
    }),
  })
}
