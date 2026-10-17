import { Badge } from "@workspace/ui/components/badge"
import type { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-status"

// Finished states are success, a cancellation is muted rather than red (nothing went wrong), the rest are in progress
const ORDER_STATUS_VARIANTS: Record<OrderStatus, "outline" | "secondary" | "success"> = {
  PENDING: "outline",
  CONFIRMED: "outline",
  PROCESSING: "outline",
  SHIPPED: "outline",
  DELIVERED: "success",
  COMPLETED: "success",
  CANCELLED: "secondary",
}

const PAYMENT_STATUS_VARIANTS: Record<PaymentStatus, "outline" | "secondary" | "success" | "destructive"> = {
  PENDING: "outline",
  PAID: "success",
  FAILED: "destructive",
  PARTIALLY_REFUNDED: "secondary",
  REFUNDED: "secondary",
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_STATUS_VARIANTS[status]}>{ORDER_STATUS_LABELS[status]}</Badge>
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={PAYMENT_STATUS_VARIANTS[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>
}
