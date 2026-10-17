import { OrderStatus, PaymentMethod, PaymentStatus, ShippingMethod } from "@workspace/db/enums"

// Order fulfilment rules, shared by the actions and the pages. OrderStatus tracks fulfilment only;
// PaymentStatus is the source of truth for money.

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Unpaid",
  PAID: "Paid",
  FAILED: "Failed",
  PARTIALLY_REFUNDED: "Partly refunded",
  REFUNDED: "Refunded",
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  MOBILE_MONEY: "Mobile money",
}

// Shipped is only for delivery: a pickup order goes from processing to delivered (collected).
// Cancelling is possible until the order has left.
export function nextOrderStatuses(status: OrderStatus, shippingMethod: ShippingMethod): OrderStatus[] {
  switch (status) {
    case OrderStatus.PENDING:
      return [OrderStatus.CONFIRMED, OrderStatus.CANCELLED]
    case OrderStatus.CONFIRMED:
      return [OrderStatus.PROCESSING, OrderStatus.CANCELLED]
    case OrderStatus.PROCESSING:
      return [shippingMethod === ShippingMethod.DELIVERY ? OrderStatus.SHIPPED : OrderStatus.DELIVERED, OrderStatus.CANCELLED]
    case OrderStatus.SHIPPED:
      return [OrderStatus.DELIVERED]
    case OrderStatus.DELIVERED:
      return [OrderStatus.COMPLETED]
    case OrderStatus.COMPLETED:
    case OrderStatus.CANCELLED:
      return []
  }
}

// Money has changed hands, so cancelling needs a refund, which is the platform's to give
export function isPaid(paymentStatus: PaymentStatus) {
  return paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.PARTIALLY_REFUNDED
}

// Payment was taken at some point, whether or not any of it was refunded since: completing an order needs this
export function hasBeenPaid(paymentStatus: PaymentStatus) {
  return paymentStatus !== PaymentStatus.PENDING && paymentStatus !== PaymentStatus.FAILED
}
