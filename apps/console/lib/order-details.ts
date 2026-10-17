import "server-only"

import type { OrderLine, OrderTimelineEntry, OrderTotals } from "@/types"
import { Prisma } from "@workspace/db/client"
import { formatCurrency } from "@workspace/utils/currency"
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "./order-status"

// What the store's and the platform's order details loaders share: the query and turning its rows into page data

export const orderDetailsInclude = {
  orderItems: { orderBy: { id: "asc" } },
  statusHistory: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { name: true } } } },
  refunds: { orderBy: { createdAt: "desc" }, include: { refundedBy: { select: { name: true } } } },
  createdBy: { select: { name: true } },
  paymentRecordedBy: { select: { name: true } },
} satisfies Prisma.OrderInclude

export type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderDetailsInclude }>
type LineRow = OrderWithDetails["orderItems"][number]

const ghs = (amount: Prisma.Decimal) => formatCurrency(amount.toString(), "GHS", "en-GH")

// Staff of other stores and the platform can appear on an order, so a missing name never falls back to their email
export function staffName(user: { name: string | null } | null) {
  return user ? (user.name ?? "Staff") : null
}

// A line as the customer pays for it: after its share of the discount, with its tax
export function sumLines(lines: Pick<LineRow, "totalPriceGhs" | "discountGhs" | "taxGhs">[]) {
  return lines.reduce((sum, line) => sum.plus(line.totalPriceGhs.minus(line.discountGhs).plus(line.taxGhs)), new Prisma.Decimal(0))
}

export function toOrderLine(line: LineRow): OrderLine {
  return {
    id: line.id,
    productName: line.productName,
    variantDescription: line.variantDescription,
    sku: line.sku,
    productImage: line.productImage,
    storeName: line.storeName,
    quantity: line.quantity,
    unitPriceGhs: line.unitPriceGhs.toString(),
    totalPriceGhs: line.totalPriceGhs.toString(),
    discountGhs: line.discountGhs.toString(),
    taxGhs: line.taxGhs.toString(),
  }
}

export function toOrderTotals(order: OrderWithDetails): OrderTotals {
  return {
    subtotalGhs: order.subtotalGhs.toString(),
    discountType: order.discountType,
    discountValue: order.discountValue?.toString() ?? null,
    discountAmountGhs: order.discountAmountGhs?.toString() ?? null,
    discountReason: order.discountReason,
    shippingGhs: order.shippingGhs.toString(),
    taxRate: order.taxRate.toString(),
    taxGhs: order.taxGhs.toString(),
    totalGhs: order.totalGhs.toString(),
  }
}

// Status changes, the recorded payment and refunds, newest first. Amounts only when the viewer may see the whole
// order's money: a store sharing an order with others sees neither the total nor the refunds.
export function toOrderTimeline(order: OrderWithDetails, showAmounts: boolean): OrderTimelineEntry[] {
  const method = (value: keyof typeof PAYMENT_METHOD_LABELS) => PAYMENT_METHOD_LABELS[value].toLowerCase()
  return [
    ...order.statusHistory.map((entry) => ({
      id: entry.id,
      title: ORDER_STATUS_LABELS[entry.status],
      note: entry.note,
      changedBy: staffName(entry.changedBy),
      createdAt: entry.createdAt,
    })),
    ...(order.paidAt
      ? [
          {
            id: "payment",
            title: "Payment recorded",
            note: showAmounts ? `${ghs(order.totalGhs)} by ${method(order.paymentMethod)}` : PAYMENT_METHOD_LABELS[order.paymentMethod],
            changedBy: staffName(order.paymentRecordedBy),
            createdAt: order.paidAt,
          },
        ]
      : []),
    ...(showAmounts
      ? order.refunds.map((refund) => ({
          id: refund.id,
          title: `Refunded ${ghs(refund.amountGhs)}`,
          note: `By ${method(refund.method)}: ${refund.reason}`,
          changedBy: staffName(refund.refundedBy),
          createdAt: refund.createdAt,
        }))
      : []),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

// The fields both pages show, given the lines the viewer may see
export function toOrderDetailsBase(order: OrderWithDetails, lines: LineRow[], showAmounts: boolean) {
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paidAt: order.paidAt,
    shippingMethod: order.shippingMethod,
    customer: { name: order.customerName, email: order.customerEmail, phone: order.customerPhone, isRegistered: !!order.userId },
    shipping:
      order.shippingMethod === "DELIVERY"
        ? { name: order.shippingName, phone: order.shippingPhone, line1: order.shippingLine1, line2: order.shippingLine2, region: order.shippingRegion, town: order.shippingTown }
        : null,
    notes: order.notes,
    lines: lines.map(toOrderLine),
    isMultiStore: new Set(order.orderItems.map((line) => line.organizationId)).size > 1,
    exchangeRate: order.exchangeRate.toString(),
    createdBy: staffName(order.createdBy),
    createdAt: order.createdAt,
    timeline: toOrderTimeline(order, showAmounts),
  }
}
