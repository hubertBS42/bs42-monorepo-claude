import type { OrderStatus, PaymentMethod, PaymentStatus } from "@workspace/db/enums"
import type { OrderDetails, OrderLine, OrderTotals, StoreOrderDetails } from "@/types"

// One of the dashboard's recent orders, as the table and the card show it
export interface OrderSummary {
  id: string
  reference: string
  href: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  paidAt: Date | null
  createdAt: Date
  customer: { name: string; email: string | null; phone: string | null }
  // Null for a pickup order
  shipping: { name: string | null; phone: string | null; line1: string | null; line2: string | null; region: string | null; town: string | null } | null
  // The lines the viewer may see: on a store's dashboard, only its own
  lines: OrderLine[]
  // Null on a store's dashboard for an order shared with other stores, whose total covers their items too
  totals: OrderTotals | null
  // What the orders list shows: the order's total, or the store's lines on an order shared with other stores
  totalGhs: string
  // Under the customer: the stores' names on the platform's dashboard, or a note on the store's
  note?: string
}

// Only what the table and the card show, so the details pages' timeline and refunds don't go to the browser
export function toOrderSummary(order: OrderDetails | StoreOrderDetails, extra: Pick<OrderSummary, "href" | "totalGhs" | "note">): OrderSummary {
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    customer: { name: order.customer.name, email: order.customer.email, phone: order.customer.phone },
    shipping: order.shipping,
    lines: order.lines,
    totals: order.totals,
    ...extra,
  }
}
