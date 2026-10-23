import "server-only"

import type { OrderAfterSale, OrderLine, OrderReturnEntry, OrderTimelineEntry, OrderTotals, ReturnableLine } from "@/types"
import { Prisma } from "@workspace/db/client"
import { formatCurrency } from "@workspace/utils/currency"
import { returnedUnitsAmount } from "@workspace/commerce/pricing"
import { returnedSoFar } from "./order-refunds"
import { installationLeftGhs } from "./order-installation"
import { InstallationStatus } from "@workspace/db/enums"
import { formatDate } from "@workspace/utils/date"
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { quoteUrl } from "@workspace/commerce/order-links"

// What the store's and the platform's order details loaders share: the query and turning its rows into page data

export const orderDetailsInclude = {
  orderItems: {
    orderBy: { id: "asc" },
    include: {
      returns: { select: { quantity: true } },
    },
  },
  statusHistory: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { name: true } } } },
  installationHistory: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { name: true } } } },
  refunds: { orderBy: { createdAt: "desc" }, include: { refundedBy: { select: { name: true } }, return: { select: { id: true } } } },
  returns: {
    orderBy: { createdAt: "desc" },
    include: {
      recordedBy: { select: { name: true } },
      refund: { select: { amountGhs: true, method: true } },
      items: { orderBy: { orderItemId: "asc" }, select: { orderItemId: true, quantity: true, restocked: true } },
    },
  },
  createdBy: { select: { name: true } },
  paymentRecordedBy: { select: { name: true } },
  paymentAttempts: { orderBy: { createdAt: "desc" } },
  quote: { select: { id: true, reference: true } },
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
    returnedQuantity: returnedSoFar(line),
    unitPriceGhs: line.unitPriceGhs.toString(),
    totalPriceGhs: line.totalPriceGhs.toString(),
    discountGhs: line.discountGhs.toString(),
    taxGhs: line.taxGhs.toString(),
    installationGhs: line.installationUnitGhs ? line.installationTotalGhs.toString() : null,
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
    installationGhs: order.installationGhs.toString(),
    taxRate: order.taxRate.toString(),
    taxGhs: order.taxGhs.toString(),
    totalGhs: order.totalGhs.toString(),
  }
}

const units = (count: number) => (count === 1 ? "1 item" : `${count} items`)

// A @db.Date comes back as midnight UTC, which formatDate's zone (Accra's) reads as the same day
const day = (date: Date) => formatDate(date, "EEE d MMM yyyy")

const INSTALLATION_TITLES: Record<InstallationStatus, (date: Date | null) => string> = {
  TO_ARRANGE: () => "Installation to arrange",
  BOOKED: (date) => (date ? `Installation booked for ${day(date)}` : "Installation booked"),
  DONE: () => "Installation done",
  CANCELLED: () => "Installation cancelled",
}

// Whether the installation is still to happen, so a return or a cancellation can refund it
export const installationPending = (status: InstallationStatus | null) => status === InstallationStatus.TO_ARRANGE || status === InstallationStatus.BOOKED

// Status changes, the recorded payment, refunds and returns, newest first. Amounts only when the viewer may see the
// whole order's money: a store sharing an order with others sees neither the total nor the refunds. Returns count
// only the lines the viewer sees (lineIds).
export function toOrderTimeline(order: OrderWithDetails, showAmounts: boolean, lineIds: Set<string>): OrderTimelineEntry[] {
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
    // Arranging it starts with the order, so its first entry says nothing new
    ...order.installationHistory
      .filter((entry) => entry.status !== InstallationStatus.TO_ARRANGE)
      .map((entry) => ({ id: entry.id, title: INSTALLATION_TITLES[entry.status](entry.date), note: entry.note, changedBy: staffName(entry.changedBy), createdAt: entry.createdAt })),
    // A return's refund shows on the return's entry
    ...(showAmounts
      ? order.refunds
          .filter((refund) => !refund.return)
          .map((refund) => ({
            id: refund.id,
            title: `Refunded ${ghs(refund.amountGhs)}`,
            note: `By ${method(refund.method)}: ${refund.reason}`,
            changedBy: staffName(refund.refundedBy),
            createdAt: refund.createdAt,
          }))
      : []),
    ...order.returns.flatMap((entry) => {
      const items = entry.items.filter((item) => lineIds.has(item.orderItemId))
      if (items.length === 0) return []
      const restocked = items.filter((item) => item.restocked).reduce((sum, item) => sum + item.quantity, 0)
      const refund = showAmounts && entry.refund ? `, ${ghs(entry.refund.amountGhs)} refunded by ${method(entry.refund.method)}` : ""
      return [
        {
          id: entry.id,
          title: `Returned ${units(items.reduce((sum, item) => sum + item.quantity, 0))}${refund}`,
          note: `${entry.reason}${restocked ? ` (${restocked} back in stock)` : ""}`,
          changedBy: staffName(entry.recordedBy),
          createdAt: entry.createdAt,
        },
      ]
    }),
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
    timeline: toOrderTimeline(order, showAmounts, new Set(lines.map((line) => line.id))),
    quote: order.quote && { ...order.quote, url: quoteUrl(order.quote.reference, order.quote.id) },
    trade: order.tradeCompanyName ? { accountId: order.tradeAccountId, companyName: order.tradeCompanyName, tin: order.tradeTin } : null,
    installation: order.installationStatus
      ? { status: order.installationStatus, date: order.installationDate?.toISOString().slice(0, 10) ?? null, leftGhs: installationLeftGhs(order.orderItems).toString() }
      : null,
    paymentAttempts: order.paymentAttempts.map((attempt) => ({
      id: attempt.id,
      reference: attempt.reference,
      amountGhs: showAmounts ? attempt.amountGhs.toString() : null,
      status: attempt.status,
      channel: attempt.channel,
      gatewayResponse: attempt.gatewayResponse,
      paidAt: attempt.paidAt,
      createdAt: attempt.createdAt,
    })),
  }
}

// The refunds and returns side of the order, for whoever manages it (the platform, or the store for its own orders)
export function toOrderAfterSale(order: OrderWithDetails): OrderAfterSale {
  const refunded = order.refunds.reduce((sum, refund) => sum.plus(refund.amountGhs), new Prisma.Decimal(0))
  return {
    refundedGhs: refunded.toString(),
    refundableGhs: order.totalGhs.minus(refunded).toString(),
    returns: toOrderReturns(order),
    returnableLines: toReturnableLines(order),
  }
}

// Returns, newest first
function toOrderReturns(order: OrderWithDetails): OrderReturnEntry[] {
  const lines = new Map(order.orderItems.map((line) => [line.id, line]))
  return order.returns.map((entry) => ({
    id: entry.id,
    reason: entry.reason,
    refundGhs: entry.refund?.amountGhs.toString() ?? null,
    recordedBy: staffName(entry.recordedBy),
    createdAt: entry.createdAt,
    items: entry.items.map((item) => {
      const line = lines.get(item.orderItemId)!
      return { productName: line.productName, variantDescription: line.variantDescription, quantity: item.quantity, restocked: item.restocked }
    }),
  }))
}

// The lines with units still to come back, for the return form: what each number of them is worth (the suggested
// refund, with their installation while it's still to happen) and whether its listing tracks stock (it can be restocked)
function toReturnableLines(order: OrderWithDetails): ReturnableLine[] {
  const withInstallation = installationPending(order.installationStatus)
  return order.orderItems.flatMap((line) => {
    const returned = returnedSoFar(line)
    const left = line.quantity - returned
    if (left <= 0) return []
    const goods = line.totalPriceGhs.minus(line.discountGhs).plus(line.taxGhs)
    const paid = withInstallation ? goods.plus(line.installationTotalGhs).plus(line.installationTaxGhs) : goods
    return [
      {
        orderItemId: line.id,
        productName: line.productName,
        variantDescription: line.variantDescription,
        storeName: line.storeName,
        left,
        tracksStock: line.tracksStock,
        valueByQuantity: Array.from({ length: left + 1 }, (_, count) => returnedUnitsAmount(paid, line.quantity, returned, count).toString()),
      },
    ]
  })
}
