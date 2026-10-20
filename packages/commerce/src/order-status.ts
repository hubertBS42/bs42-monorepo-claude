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

// Money has changed hands, so cancelling needs a refund (Cancel and refund)
export function isPaid(paymentStatus: PaymentStatus) {
  return paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.PARTIALLY_REFUNDED
}

// Payment was taken at some point, whether or not any of it was refunded since: completing an order needs this
export function hasBeenPaid(paymentStatus: PaymentStatus) {
  return paymentStatus !== PaymentStatus.PENDING && paymentStatus !== PaymentStatus.FAILED
}

// Items come back only once the customer has them: before that, the order is cancelled instead
export function canBeReturned(status: OrderStatus) {
  return status === OrderStatus.DELIVERED || status === OrderStatus.COMPLETED
}

// Why the Returns card offers no Record return button, or null when it does. A return needs a recorded payment, so
// staff record the payment and then refund what came back, and the amounts add up.
export function returnBlockedReason(order: { status: OrderStatus; paymentStatus: PaymentStatus }, returnableLineCount: number) {
  if (!canBeReturned(order.status)) return "Items can be returned once the order has been delivered."
  if (!hasBeenPaid(order.paymentStatus)) return "Record the payment before recording a return, then refund what came back."
  if (returnableLineCount === 0) return "Everything on this order has been returned."
  return null
}

// "Returned" when every unit came back, "Partly returned" when some did, else null
export function returnLabel(sold: number, returned: number) {
  if (returned === 0) return null
  return returned >= sold ? "Returned" : "Partly returned"
}
