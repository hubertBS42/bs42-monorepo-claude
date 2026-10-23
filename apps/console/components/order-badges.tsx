import { Badge } from "@workspace/ui/components/badge"
import type { InstallationStatus, OrderStatus, PaymentStatus, ProductRequestStatus, PurchaseOrderStatus, TradeAccountStatus } from "@workspace/db/enums"
import { TRADE_ACCOUNT_STATUS_LABELS } from "@workspace/commerce/trade-account-status"
import { INSTALLATION_STATUS_LABELS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@workspace/commerce/order-status"
import { PURCHASE_ORDER_STATUS_LABELS } from "@/lib/purchase-order-status"

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

// Like orders: received is done, closed and cancelled are muted, the rest are in progress
const PURCHASE_ORDER_STATUS_VARIANTS: Record<PurchaseOrderStatus, "outline" | "secondary" | "success"> = {
  DRAFT: "outline",
  ORDERED: "outline",
  PARTIALLY_RECEIVED: "outline",
  RECEIVED: "success",
  CLOSED: "secondary",
  CANCELLED: "secondary",
}

// Like orders: done is success, cancelled is muted, the rest are still to happen
const INSTALLATION_STATUS_VARIANTS: Record<InstallationStatus, "outline" | "secondary" | "success"> = {
  TO_ARRANGE: "outline",
  BOOKED: "outline",
  DONE: "success",
  CANCELLED: "secondary",
}

export function InstallationStatusBadge({ status }: { status: InstallationStatus }) {
  return <Badge variant={INSTALLATION_STATUS_VARIANTS[status]}>{INSTALLATION_STATUS_LABELS[status]}</Badge>
}

// Pending waits on staff, so it stands out; rejected and suspended are muted
const TRADE_ACCOUNT_STATUS_VARIANTS: Record<TradeAccountStatus, "outline" | "secondary" | "success"> = {
  PENDING: "outline",
  APPROVED: "success",
  REJECTED: "secondary",
  SUSPENDED: "secondary",
}

export function TradeAccountStatusBadge({ status }: { status: TradeAccountStatus }) {
  return <Badge variant={TRADE_ACCOUNT_STATUS_VARIANTS[status]}>{TRADE_ACCOUNT_STATUS_LABELS[status]}</Badge>
}

// "Added" and "In the catalogue" both end in a product to list
export const PRODUCT_REQUEST_STATUS_LABELS: Record<ProductRequestStatus, string> = {
  PENDING: "Pending",
  CREATED: "Added",
  MATCHED: "In the catalogue",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
}

const PRODUCT_REQUEST_STATUS_VARIANTS: Record<ProductRequestStatus, "outline" | "secondary" | "success"> = {
  PENDING: "outline",
  CREATED: "success",
  MATCHED: "success",
  DECLINED: "secondary",
  CANCELLED: "secondary",
}

export function ProductRequestStatusBadge({ status }: { status: ProductRequestStatus }) {
  return <Badge variant={PRODUCT_REQUEST_STATUS_VARIANTS[status]}>{PRODUCT_REQUEST_STATUS_LABELS[status]}</Badge>
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_STATUS_VARIANTS[status]}>{ORDER_STATUS_LABELS[status]}</Badge>
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={PAYMENT_STATUS_VARIANTS[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>
}

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <Badge variant={PURCHASE_ORDER_STATUS_VARIANTS[status]}>{PURCHASE_ORDER_STATUS_LABELS[status]}</Badge>
}
