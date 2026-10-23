import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { dayStart, formatDate } from "@workspace/utils/date"
import type { DashboardChanges, DashboardOrderCounts, DashboardPeriod, DashboardSales, DashboardSalesTrend, DashboardTopSellers, PlatformDashboard, StoreDashboard, TopSeller } from "../types"
import { sumLines } from "./order-details"
import { overduePurchaseOrderWhere } from "./purchase-order-status"
import { countStockAlerts } from "./stock-states"

// The dashboard's numbers, apart from access checks (lib/data/dashboard.data.ts), so a script can run them in a
// transaction against the database

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const PERIOD_DAYS: Record<DashboardPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 }

// Paid at some point (hasBeenPaid), whether or not refunded since
const paidStatuses = { notIn: [PaymentStatus.PENDING, PaymentStatus.FAILED] }

const dayKey = (date: Date) => formatDate(date, "yyyy-MM-dd")

// The days the period and the one before it cover, oldest first, as yyyy-MM-dd in the app's time zone
function trendDays(period: DashboardPeriod, now: Date) {
  const count = PERIOD_DAYS[period] * 2
  const today = dayKey(now)
  return Array.from({ length: count }, (_, index) => dayKey(dayStart(today, index + 1 - count)))
}

// Where the rows for a trend start: the first day of the previous period
export function trendStart(period: DashboardPeriod, now = new Date()) {
  return dayStart(trendDays(period, now)[0]!)
}

// Where the current period starts
function periodStart(period: DashboardPeriod, now: Date) {
  return dayStart(trendDays(period, now)[PERIOD_DAYS[period]]!)
}

// How many best sellers the dashboard lists
const TOP_SELLERS = 5

// The lines a best-seller list adds up: sold on orders paid in the period and not cancelled since (a paid order is
// cancelled only with a refund), with the units returned since
const topSellerLines = (tx: Tx, period: DashboardPeriod, now: Date, storeId: string | null) =>
  tx.orderItem.findMany({
    where: {
      ...(storeId ? { organizationId: storeId } : {}),
      order: { paidAt: { gte: periodStart(period, now) }, paymentStatus: paidStatuses, status: { not: OrderStatus.CANCELLED } },
    },
    select: {
      storeListingId: true,
      productId: true,
      productName: true,
      productImage: true,
      quantity: true,
      totalPriceGhs: true,
      discountGhs: true,
      returns: { select: { quantity: true } },
      order: { select: { paidAt: true } },
    },
  })

type TopSellerLine = Awaited<ReturnType<typeof topSellerLines>>[number]

// Adds the lines up per listing or product, each line's goods after its discount shared over the units not returned.
// The name and picture are the latest sale's, so a renamed product shows its current name.
function toTopSellers(lines: TopSellerLine[], group: (line: TopSellerLine) => { id: string; href: string | null }): DashboardTopSellers {
  const sellers = new Map<string, Omit<TopSeller, "revenueGhs"> & { revenue: Prisma.Decimal; latest: Date }>()
  for (const line of lines) {
    const units = line.quantity - line.returns.reduce((sum, row) => sum + row.quantity, 0)
    if (units <= 0) continue
    const revenue = line.totalPriceGhs.minus(line.discountGhs).times(units).dividedBy(line.quantity)
    const { id, href } = group(line)
    const paidAt = line.order.paidAt!
    const seller = sellers.get(id)
    if (!seller) {
      sellers.set(id, { id, href, name: line.productName, image: line.productImage, units, revenue, latest: paidAt })
      continue
    }
    seller.units += units
    seller.revenue = seller.revenue.plus(revenue)
    if (paidAt > seller.latest) Object.assign(seller, { name: line.productName, image: line.productImage, latest: paidAt })
  }
  const all = [...sellers.values()]
  const toSeller = (seller: (typeof all)[number]): TopSeller => ({
    id: seller.id,
    name: seller.name,
    image: seller.image,
    href: seller.href,
    units: seller.units,
    revenueGhs: seller.revenue.toFixed(2),
  })
  return {
    byUnits: [...all]
      .sort((a, b) => b.units - a.units || b.revenue.comparedTo(a.revenue) || a.name.localeCompare(b.name))
      .slice(0, TOP_SELLERS)
      .map(toSeller),
    byRevenue: [...all]
      .sort((a, b) => b.revenue.comparedTo(a.revenue) || b.units - a.units || a.name.localeCompare(b.name))
      .slice(0, TOP_SELLERS)
      .map(toSeller),
  }
}

// What happened on the trend's days: payments (an order's amount, by when it was paid), refunds and returns
interface TrendRows {
  payments: { at: Date; amountGhs: Prisma.Decimal }[]
  refunds: { at: Date; amountGhs: Prisma.Decimal }[]
  returns: { at: Date }[]
}

function toSales(rows: TrendRows): DashboardSales {
  const gross = rows.payments.reduce((sum, row) => sum.plus(row.amountGhs), new Prisma.Decimal(0))
  const refunded = rows.refunds.reduce((sum, row) => sum.plus(row.amountGhs), new Prisma.Decimal(0))
  const paidOrders = rows.payments.length
  return {
    netSalesGhs: gross.minus(refunded).toFixed(2),
    paidOrders,
    averageOrderGhs: paidOrders ? gross.dividedBy(paidOrders).toFixed(2) : null,
    refundedGhs: refunded.toFixed(2),
    refunds: rows.refunds.length,
    returns: rows.returns.length,
  }
}

function change(current: string | number | null, previous: string | number | null) {
  if (current === null || previous === null || new Prisma.Decimal(previous).isZero()) return null
  return new Prisma.Decimal(current).minus(previous).dividedBy(previous).times(100).toDecimalPlaces(1).toNumber()
}

export function toSalesTrend(period: DashboardPeriod, rows: TrendRows, now = new Date()): DashboardSalesTrend {
  const days = trendDays(period, now)
  const currentDays = days.slice(PERIOD_DAYS[period])
  const firstCurrentDay = currentDays[0]!
  // yyyy-MM-dd keys sort as dates
  const split = <Row extends { at: Date }>(list: Row[]) => {
    const previous: Row[] = []
    const current: Row[] = []
    for (const row of list) (dayKey(row.at) < firstCurrentDay ? previous : current).push(row)
    return { previous, current }
  }
  const payments = split(rows.payments)
  const refunds = split(rows.refunds)
  const returns = split(rows.returns)

  const current = toSales({ payments: payments.current, refunds: refunds.current, returns: returns.current })
  const previous = toSales({ payments: payments.previous, refunds: refunds.previous, returns: returns.previous })
  const changes: DashboardChanges = {
    netSales: change(current.netSalesGhs, previous.netSalesGhs),
    paidOrders: change(current.paidOrders, previous.paidOrders),
    averageOrder: change(current.averageOrderGhs, previous.averageOrderGhs),
    refunded: change(current.refundedGhs, previous.refundedGhs),
  }

  const net = new Map<string, Prisma.Decimal>()
  const add = (at: Date, amountGhs: Prisma.Decimal) => net.set(dayKey(at), (net.get(dayKey(at)) ?? new Prisma.Decimal(0)).plus(amountGhs))
  for (const row of payments.current) add(row.at, row.amountGhs)
  for (const row of refunds.current) add(row.at, row.amountGhs.negated())

  return { current, changes, days: currentDays.map((date) => ({ date, netSalesGhs: (net.get(date) ?? new Prisma.Decimal(0)).toFixed(2) })) }
}

async function countOrders(tx: Tx, where: Prisma.OrderWhereInput): Promise<DashboardOrderCounts> {
  const [pending, confirmed, processing, unpaidDelivered] = await Promise.all([
    tx.order.count({ where: { ...where, status: OrderStatus.PENDING } }),
    tx.order.count({ where: { ...where, status: OrderStatus.CONFIRMED } }),
    tx.order.count({ where: { ...where, status: OrderStatus.PROCESSING } }),
    tx.order.count({ where: { ...where, status: OrderStatus.DELIVERED, paymentStatus: PaymentStatus.PENDING } }),
  ])
  return { pending, confirmed, processing, unpaidDelivered }
}

// The counts match the store's orders list, which shows every order with the store's items
export async function getStoreStats(tx: Tx, storeId: string, period: DashboardPeriod, now = new Date()): Promise<StoreDashboard> {
  const from = trendStart(period, now)
  const withStoreItems = { orderItems: { some: { organizationId: storeId } } }
  // Orders made only of the store's items (`some` as well, since `every` holds for an order without items). Refunds
  // and returns on the others are the platform's, and can't be split between the stores.
  const ownOrder = { orderItems: { some: { organizationId: storeId }, every: { organizationId: storeId } } }

  const [orders, stock, overduePurchaseOrders, paidOrders, refunds, returns, sellerLines] = await Promise.all([
    countOrders(tx, withStoreItems),
    countStockAlerts(tx, storeId),
    tx.purchaseOrder.count({ where: { organizationId: storeId, ...overduePurchaseOrderWhere(formatDate(now, "yyyy-MM-dd")) } }),
    tx.order.findMany({
      where: { ...withStoreItems, paidAt: { gte: from }, paymentStatus: paidStatuses },
      select: { paidAt: true, totalGhs: true, orderItems: { select: { organizationId: true, totalPriceGhs: true, discountGhs: true, taxGhs: true } } },
    }),
    tx.orderRefund.findMany({ where: { createdAt: { gte: from }, order: ownOrder }, select: { createdAt: true, amountGhs: true } }),
    tx.orderReturn.findMany({ where: { createdAt: { gte: from }, order: ownOrder }, select: { createdAt: true } }),
    // Its own lines, on shared orders too, as its sales count them
    topSellerLines(tx, period, now, storeId),
  ])

  // An order with other stores' items counts only the store's lines, as the orders list shows it
  const payments = paidOrders.map((order) => {
    const ownLines = order.orderItems.filter((line) => line.organizationId === storeId)
    return { at: order.paidAt!, amountGhs: ownLines.length === order.orderItems.length ? order.totalGhs : sumLines(ownLines) }
  })

  return {
    orders,
    lowStock: stock[0]?.low ?? 0,
    outOfStock: stock[0]?.out ?? 0,
    overduePurchaseOrders,
    sales: toSalesTrend(period, { payments, refunds: refunds.map((row) => ({ at: row.createdAt, amountGhs: row.amountGhs })), returns: returns.map((row) => ({ at: row.createdAt })) }, now),
    topSellers: toTopSellers(sellerLines, (line) => ({ id: line.storeListingId, href: `/store/listings/${line.storeListingId}/edit` })),
  }
}

export async function getPlatformStats(tx: Tx, period: DashboardPeriod, now = new Date()): Promise<PlatformDashboard> {
  const from = trendStart(period, now)

  const [orders, pendingOrders, stockAlerts, overduePurchaseOrders, paidOrders, refunds, returns, sellerLines] = await Promise.all([
    countOrders(tx, {}),
    // Prisma can't filter on how many stores an order's items come from, so the pending orders' stores are counted
    // here; there are only ever a handful
    tx.order.findMany({ where: { status: OrderStatus.PENDING }, select: { orderItems: { select: { organizationId: true } } } }),
    countStockAlerts(tx, null),
    tx.purchaseOrder.count({ where: overduePurchaseOrderWhere(formatDate(now, "yyyy-MM-dd")) }),
    tx.order.findMany({ where: { paidAt: { gte: from }, paymentStatus: paidStatuses }, select: { paidAt: true, totalGhs: true } }),
    tx.orderRefund.findMany({ where: { createdAt: { gte: from } }, select: { createdAt: true, amountGhs: true } }),
    tx.orderReturn.findMany({ where: { createdAt: { gte: from } }, select: { createdAt: true } }),
    topSellerLines(tx, period, now, null),
  ])

  const multiStorePending = pendingOrders.filter((order) => new Set(order.orderItems.map((line) => line.organizationId)).size > 1).length

  const stores = await tx.organization.findMany({ where: { id: { in: stockAlerts.map((row) => row.storeId) } }, select: { id: true, name: true } })
  const storeNames = new Map(stores.map((store) => [store.id, store.name]))

  return {
    orders: { ...orders, multiStorePending },
    stockAlerts: stockAlerts
      .map((row) => ({ ...row, storeName: storeNames.get(row.storeId) ?? "Unknown store" }))
      .sort((a, b) => b.out - a.out || b.low - a.low || a.storeName.localeCompare(b.storeName)),
    overduePurchaseOrders,
    sales: toSalesTrend(
      period,
      {
        payments: paidOrders.map((order) => ({ at: order.paidAt!, amountGhs: order.totalGhs })),
        refunds: refunds.map((row) => ({ at: row.createdAt, amountGhs: row.amountGhs })),
        returns: returns.map((row) => ({ at: row.createdAt })),
      },
      now
    ),
    // A product sold by several stores counts once. Lines always have a product; productId is optional only in the schema.
    topSellers: toTopSellers(sellerLines, (line) => (line.productId ? { id: line.productId, href: `/catalogue/products/${line.productId}/edit` } : { id: line.storeListingId, href: null })),
  }
}
