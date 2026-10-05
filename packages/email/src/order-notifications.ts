import { sendEmail } from "./mailer.js"
import { OrderConfirmation } from "./templates/order/order-confirmation.js"
import { OrderConfirmed } from "./templates/order/order-confirmed.js"
import { OrderShipped } from "./templates/order/order-shipped.js"
import { OrderDelivered } from "./templates/order/order-delivered.js"
import { OrderCancelled } from "./templates/order/order-cancelled.js"
import { OrderRefunded } from "./templates/order/order-refunded.js"

export interface BaseOrderEmail {
  to: string
  customerName: string
  reference: string
}

export interface OrderConfirmationEmail extends BaseOrderEmail {
  items: {
    productName: string
    variantDescription: string | null
    quantity: number
    unitPrice: number
    totalPrice: number
    exchangeRate: number
  }[]
  subtotalGhs: number
  shippingPrice: number
  taxPrice: number
  discountAmount: number | null
  discountType: string | null
  discountValue: number | null
  discountReason: string | null
  totalPrice: number
  shippingMethod: string
  shippingAddress?: string | null
  paymentMethod: string
}

export async function sendOrderConfirmationEmail(data: OrderConfirmationEmail) {
  return sendEmail({
    to: data.to,
    subject: `Order Confirmation — ${data.reference}`,
    reactTemplate: OrderConfirmation({
      customerName: data.customerName,
      reference: data.reference,
      items: data.items,
      subtotalGhs: data.subtotalGhs,
      shippingPrice: data.shippingPrice,
      taxPrice: data.taxPrice,
      discountAmount: data.discountAmount,
      discountType: data.discountType,
      discountValue: data.discountValue,
      discountReason: data.discountReason,
      totalPrice: data.totalPrice,
      shippingMethod: data.shippingMethod,
      shippingAddress: data.shippingAddress,
      paymentMethod: data.paymentMethod,
    }),
  })
}

export async function sendOrderConfirmedEmail(
  data: BaseOrderEmail & { note?: string | null }
) {
  return sendEmail({
    to: data.to,
    subject: `Order Confirmed — ${data.reference}`,
    reactTemplate: OrderConfirmed({
      customerName: data.customerName,
      reference: data.reference,
      note: data.note,
    }),
  })
}

export async function sendOrderShippedEmail(
  data: BaseOrderEmail & { shippingAddress: string; note?: string | null }
) {
  return sendEmail({
    to: data.to,
    subject: `Your Order is On Its Way — ${data.reference}`,
    reactTemplate: OrderShipped({
      customerName: data.customerName,
      reference: data.reference,
      shippingAddress: data.shippingAddress,
      note: data.note,
    }),
  })
}

export async function sendOrderDeliveredEmail(
  data: BaseOrderEmail & { note?: string | null }
) {
  return sendEmail({
    to: data.to,
    subject: `Order Delivered — ${data.reference}`,
    reactTemplate: OrderDelivered({
      customerName: data.customerName,
      reference: data.reference,
      note: data.note,
    }),
  })
}

export async function sendOrderCancelledEmail(
  data: BaseOrderEmail & { cancellationReason: string; totalPrice: number }
) {
  return sendEmail({
    to: data.to,
    subject: `Order Cancelled — ${data.reference}`,
    reactTemplate: OrderCancelled({
      customerName: data.customerName,
      reference: data.reference,
      cancellationReason: data.cancellationReason,
      totalPrice: data.totalPrice,
    }),
  })
}

export async function sendOrderRefundedEmail(
  data: BaseOrderEmail & { refundReason: string; totalPrice: number }
) {
  return sendEmail({
    to: data.to,
    subject: `Order Refunded — ${data.reference}`,
    reactTemplate: OrderRefunded({
      customerName: data.customerName,
      reference: data.reference,
      refundReason: data.refundReason,
      totalPrice: data.totalPrice,
    }),
  })
}
