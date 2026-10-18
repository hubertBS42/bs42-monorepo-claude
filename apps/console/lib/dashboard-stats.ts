import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { dayStart, formatDate } from "@workspace/utils/date"
import type { DashboardOrderCounts, DashboardPeriod, DashboardSales, PlatformDashboard, StoreDashboard } from "../types"
import { sumLines } from "./order-details"
import { countStockAlerts } from "./stock-states"

// The dashboard's numbers, apart from access checks (lib/data/dashboard.data.ts), so a script can run them in a
// transaction against the database

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const PERIOD_DAYS: Record<DashboardPeriod, number> = { today: 1, "7d": 7, "30d": 30 }

// The start of the period's first day in the app's time zone; the period runs up to now
export function periodStart(period: DashboardPeriod, now = new Date()) {
  return dayStart(formatDate(now, "yyyy-MM-dd"), 1 - PERIOD_DAYS[period])
}

function toSales(gross: Prisma.Decimal, paidOrders: number, refunded: Prisma.Decimal, refunds: number, returns: number): DashboardSales {
  return {
    netSalesGhs: gross.minus(refunded).toFixed(2),
    paidOrders,
    averageOrderGhs: paidOrders ? gross.dividedBy(paidOrders).toFixed(2) : null,
    refundedGhs: refunded.toFixed(2),
    refunds,
    returns,
  }
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

// Paid at some point (hasBeenPaid), whether or not refunded since
const paidStatuses = { notIn: [PaymentStatus.PENDING, PaymentStatus.FAILED] }

// The counts match the store's orders list, which shows every order with the store's items
export async function getStoreStats(tx: Tx, storeId: string, from: Date): Promise<StoreDashboard> {
  const withStoreItems = { orderItems: { some: { organizationId: storeId } } }
  // Orders made only of the store's items (`some` as well, since `every` holds for an order without items). Refunds
  // and returns on the others are the platform's, and can't be split between the stores.
  const ownOrder = { orderItems: { some: { organizationId: storeId }, every: { organizationId: storeId } } }

  const [orders, stock, paidOrders, refunded, returns] = await Promise.all([
    countOrders(tx, withStoreItems),
    countStockAlerts(tx, storeId),
    tx.order.findMany({
      where: { ...withStoreItems, paidAt: { gte: from }, paymentStatus: paidStatuses },
      select: { totalGhs: true, orderItems: { select: { organizationId: true, totalPriceGhs: true, discountGhs: true, taxGhs: true } } },
    }),
    tx.orderRefund.aggregate({ where: { createdAt: { gte: from }, order: ownOrder }, _sum: { amountGhs: true }, _count: true }),
    tx.orderReturn.count({ where: { createdAt: { gte: from }, order: ownOrder } }),
  ])

  // An order with other stores' items counts only the store's lines, as the orders list shows it
  const gross = paidOrders.reduce((sum, order) => {
    const ownLines = order.orderItems.filter((line) => line.organizationId === storeId)
    return sum.plus(ownLines.length === order.orderItems.length ? order.totalGhs : sumLines(ownLines))
  }, new Prisma.Decimal(0))

  return {
    orders,
    lowStock: stock[0]?.low ?? 0,
    outOfStock: stock[0]?.out ?? 0,
    sales: toSales(gross, paidOrders.length, refunded._sum.amountGhs ?? new Prisma.Decimal(0), refunded._count, returns),
  }
}

export async function getPlatformStats(tx: Tx, from: Date): Promise<PlatformDashboard> {
  const [orders, pendingOrders, stockAlerts, paid, refunded, returns] = await Promise.all([
    countOrders(tx, {}),
    // Prisma can't filter on how many stores an order's items come from, so the pending orders' stores are counted
    // here; there are only ever a handful
    tx.order.findMany({ where: { status: OrderStatus.PENDING }, select: { orderItems: { select: { organizationId: true } } } }),
    countStockAlerts(tx, null),
    tx.order.aggregate({ where: { paidAt: { gte: from }, paymentStatus: paidStatuses }, _sum: { totalGhs: true }, _count: true }),
    tx.orderRefund.aggregate({ where: { createdAt: { gte: from } }, _sum: { amountGhs: true }, _count: true }),
    tx.orderReturn.count({ where: { createdAt: { gte: from } } }),
  ])

  const multiStorePending = pendingOrders.filter((order) => new Set(order.orderItems.map((line) => line.organizationId)).size > 1).length
  const stores = await tx.organization.findMany({ where: { id: { in: stockAlerts.map((row) => row.storeId) } }, select: { id: true, name: true } })
  const storeNames = new Map(stores.map((store) => [store.id, store.name]))

  return {
    orders: { ...orders, multiStorePending },
    stockAlerts: stockAlerts
      .map((row) => ({ ...row, storeName: storeNames.get(row.storeId) ?? "Unknown store" }))
      .sort((a, b) => b.out - a.out || b.low - a.low || a.storeName.localeCompare(b.storeName)),
    sales: toSales(paid._sum.totalGhs ?? new Prisma.Decimal(0), paid._count, refunded._sum.amountGhs ?? new Prisma.Decimal(0), refunded._count, returns),
  }
}
