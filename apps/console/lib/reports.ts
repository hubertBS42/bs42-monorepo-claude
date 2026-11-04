import "server-only"

import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { dayStart } from "@workspace/utils/date"
import { getCategoryPaths } from "./data/products.data"
import { sumLines } from "./order-details"
import { catalogueProductHref, listingHref } from "./product-links"
import { periodKey, reportPeriods, type ReportRange } from "./report-range"

// The Reports pages' numbers. Money is counted as the dashboard counts it (lib/dashboard-stats.ts), so the two agree:
// payments by when they were made (paidAt), less refunds by when they were given. Amounts go out as strings, added up
// as decimals.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Paid at some point (hasBeenPaid), whether or not refunded since
const paidStatuses = { notIn: [PaymentStatus.PENDING, PaymentStatus.FAILED] }

const ZERO = new Prisma.Decimal(0)
const sum = <Row>(rows: Row[], amount: (row: Row) => Prisma.Decimal) => rows.reduce((total, row) => total.plus(amount(row)), ZERO)

const within = (range: ReportRange) => ({ gte: dayStart(range.from), lt: dayStart(range.to, 1) })

// Rows grouped under each day or month of the range, every period present
function byPeriod<Row>(range: ReportRange, rows: Row[], at: (row: Row) => Date) {
  const groups = new Map(reportPeriods(range).map((period) => [period.key, { ...period, rows: [] as Row[] }]))
  for (const row of rows) groups.get(periodKey(at(row), range.by))?.rows.push(row)
  return [...groups.values()]
}

// ---- Sales ----

export interface SalesPeriodRow {
  key: string
  label: string
  paidOrders: number
  paymentsGhs: string
  refundsGhs: string
  netSalesGhs: string
}

export interface GoodsRow {
  id: string
  name: string
  href: string | null
  units: number
  goodsGhs: string
}

export interface SalesReport {
  summary: {
    netSalesGhs: string
    paymentsGhs: string
    paidOrders: number
    averageOrderGhs: string | null
    refundsGhs: string
    refunds: number
    goodsGhs: string
    units: number
  }
  periods: SalesPeriodRow[]
  goods: {
    byProduct: GoodsRow[]
    byCategory: GoodsRow[]
    byBrand: GoodsRow[]
    // The platform's only
    byStore: GoodsRow[] | null
  }
}

// What goods sold for: the lines on orders paid in the range and not cancelled since (a paid order is cancelled only
// with a refund), each line's goods after its discount and before tax, shared over the units not returned. As the
// dashboard's best sellers count them.
const goodsLines = (tx: Tx, range: ReportRange, storeId: string | null) =>
  tx.orderItem.findMany({
    where: {
      ...(storeId ? { organizationId: storeId } : {}),
      order: { paidAt: within(range), paymentStatus: paidStatuses, status: { not: OrderStatus.CANCELLED } },
    },
    select: {
      organizationId: true,
      storeName: true,
      storeListingId: true,
      productId: true,
      productName: true,
      quantity: true,
      totalPriceGhs: true,
      discountGhs: true,
      returns: { select: { quantity: true } },
      order: { select: { paidAt: true } },
    },
  })

type GoodsLine = Awaited<ReturnType<typeof goodsLines>>[number] & { units: number; goodsGhs: Prisma.Decimal }

// Adds the lines up per group, the biggest first. The name is the latest sale's, so a renamed product shows its
// current name.
function groupGoods(lines: GoodsLine[], group: (line: GoodsLine) => { id: string; name: string; href: string | null }): GoodsRow[] {
  const groups = new Map<string, { id: string; name: string; href: string | null; units: number; goods: Prisma.Decimal; latest: Date }>()
  for (const line of lines) {
    const { id, name, href } = group(line)
    const paidAt = line.order.paidAt!
    const row = groups.get(id)
    if (!row) {
      groups.set(id, { id, name, href, units: line.units, goods: line.goodsGhs, latest: paidAt })
      continue
    }
    row.units += line.units
    row.goods = row.goods.plus(line.goodsGhs)
    if (paidAt > row.latest) Object.assign(row, { name, latest: paidAt })
  }
  return [...groups.values()]
    .sort((a, b) => b.goods.comparedTo(a.goods) || b.units - a.units || a.name.localeCompare(b.name))
    .map((row) => ({ id: row.id, name: row.name, href: row.href, units: row.units, goodsGhs: row.goods.toFixed(2) }))
}

// storeId: a store's own report (its lines, and on an order shared with other stores only those, as its orders list
// and dashboard count them), or null for the platform's
export async function getSalesReport(tx: Tx, storeId: string | null, range: ReportRange): Promise<SalesReport> {
  const withStoreItems = storeId ? { orderItems: { some: { organizationId: storeId } } } : {}
  // Refunds on orders made only of the store's items: those on shared orders are the platform's, and can't be split
  const ownOrder = storeId ? { order: { orderItems: { some: { organizationId: storeId }, every: { organizationId: storeId } } } } : {}

  const [paidOrders, refunds, rawLines] = await Promise.all([
    tx.order.findMany({
      where: { ...withStoreItems, paidAt: within(range), paymentStatus: paidStatuses },
      select: { paidAt: true, totalGhs: true, orderItems: { select: { organizationId: true, totalPriceGhs: true, discountGhs: true, taxGhs: true } } },
    }),
    tx.orderRefund.findMany({ where: { ...ownOrder, createdAt: within(range) }, select: { createdAt: true, amountGhs: true } }),
    goodsLines(tx, range, storeId),
  ])

  const payments = paidOrders.map((order) => {
    if (!storeId) return { at: order.paidAt!, amountGhs: order.totalGhs }
    const ownLines = order.orderItems.filter((line) => line.organizationId === storeId)
    return { at: order.paidAt!, amountGhs: ownLines.length === order.orderItems.length ? order.totalGhs : sumLines(ownLines) }
  })

  const paymentGroups = new Map(byPeriod(range, payments, (row) => row.at).map((group) => [group.key, group.rows]))
  const periods = byPeriod(range, refunds, (row) => row.createdAt).map((group): SalesPeriodRow => {
    const paid = paymentGroups.get(group.key) ?? []
    const paymentsGhs = sum(paid, (row) => row.amountGhs)
    const refundsGhs = sum(group.rows, (row) => row.amountGhs)
    return {
      key: group.key,
      label: group.label,
      paidOrders: paid.length,
      paymentsGhs: paymentsGhs.toFixed(2),
      refundsGhs: refundsGhs.toFixed(2),
      netSalesGhs: paymentsGhs.minus(refundsGhs).toFixed(2),
    }
  })

  const lines: GoodsLine[] = rawLines.flatMap((line) => {
    const units = line.quantity - line.returns.reduce((total, row) => total + row.quantity, 0)
    if (units <= 0) return []
    return [{ ...line, units, goodsGhs: line.totalPriceGhs.minus(line.discountGhs).times(units).dividedBy(line.quantity) }]
  })

  // Categories and brands as the catalogue has them now: order lines keep a product's name, not where it sat
  const productIds = [...new Set(lines.flatMap((line) => (line.productId ? [line.productId] : [])))]
  const [products, categories] = await Promise.all([
    tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, categoryId: true, brand: { select: { id: true, name: true } } } }),
    tx.category.findMany({ select: { id: true, name: true, parentId: true } }),
  ])
  const productById = new Map(products.map((product) => [product.id, product]))
  const categoryPaths = getCategoryPaths(categories)
  const unknown = { id: "unknown", name: "Unknown", href: null }

  const paymentsGhs = sum(payments, (row) => row.amountGhs)
  const refundsGhs = sum(refunds, (row) => row.amountGhs)

  return {
    summary: {
      netSalesGhs: paymentsGhs.minus(refundsGhs).toFixed(2),
      paymentsGhs: paymentsGhs.toFixed(2),
      paidOrders: payments.length,
      averageOrderGhs: payments.length ? paymentsGhs.dividedBy(payments.length).toFixed(2) : null,
      refundsGhs: refundsGhs.toFixed(2),
      refunds: refunds.length,
      goodsGhs: sum(lines, (line) => line.goodsGhs).toFixed(2),
      units: lines.reduce((total, line) => total + line.units, 0),
    },
    periods,
    goods: {
      // A store's per listing, the platform's per catalogue product (a product sold by several stores counts once)
      byProduct: groupGoods(lines, (line) =>
        storeId
          ? { id: line.storeListingId, name: line.productName, href: listingHref(line.storeListingId) }
          : { id: line.productId ?? line.storeListingId, name: line.productName, href: line.productId ? catalogueProductHref(line.productId) : null }
      ),
      byCategory: groupGoods(lines, (line) => {
        const categoryId = productById.get(line.productId ?? "")?.categoryId
        return categoryId ? { id: categoryId, name: categoryPaths.get(categoryId) ?? "Unknown", href: null } : unknown
      }),
      byBrand: groupGoods(lines, (line) => {
        const brand = productById.get(line.productId ?? "")?.brand
        return brand ? { id: brand.id, name: brand.name, href: null } : { ...unknown, name: "No brand" }
      }),
      byStore: storeId ? null : groupGoods(lines, (line) => ({ id: line.organizationId, name: line.storeName, href: null })),
    },
  }
}

// ---- Tax ----

export interface TaxPeriodRow {
  key: string
  label: string
  paidOrders: number
  salesExTaxGhs: string
  goodsTaxGhs: string
  deliveryTaxGhs: string
  installationTaxGhs: string
  taxGhs: string
  refundedTaxGhs: string
  netTaxGhs: string
}

export interface TaxRateRow {
  // A fraction, as orders keep it ("0.1500")
  rate: string
  paidOrders: number
  salesExTaxGhs: string
  taxGhs: string
}

export interface TaxReport {
  summary: {
    salesExTaxGhs: string
    goodsTaxGhs: string
    deliveryTaxGhs: string
    installationTaxGhs: string
    taxGhs: string
    refundedTaxGhs: string
    netTaxGhs: string
    paidOrders: number
    refunds: number
  }
  periods: TaxPeriodRow[]
  byRate: TaxRateRow[]
}

// The tax a refund gave back: refunds are money only, with no tax of their own, so it's the order's share of tax in
// its total, rounded once per refund
const refundTax = (refund: { amountGhs: Prisma.Decimal; order: { totalGhs: Prisma.Decimal; taxGhs: Prisma.Decimal } }) =>
  refund.order.totalGhs.isZero() ? ZERO : refund.amountGhs.times(refund.order.taxGhs).dividedBy(refund.order.totalGhs).toDecimalPlaces(2)

// The platform's tax: it's the seller of record, so there's no store's version. Tax is counted when the order was
// paid, and given back when a refund was.
export async function getTaxReport(tx: Tx, range: ReportRange): Promise<TaxReport> {
  const [rawOrders, rawRefunds] = await Promise.all([
    tx.order.findMany({
      where: { paidAt: within(range), paymentStatus: paidStatuses },
      select: { paidAt: true, totalGhs: true, taxGhs: true, taxRate: true, orderItems: { select: { taxGhs: true, installationTaxGhs: true } } },
    }),
    tx.orderRefund.findMany({ where: { createdAt: within(range) }, select: { createdAt: true, amountGhs: true, order: { select: { totalGhs: true, taxGhs: true } } } }),
  ])

  // An order's tax is its lines' tax on goods and on installation, plus the tax on delivery (taxShipping)
  const orders = rawOrders.map((order) => {
    const goodsTax = sum(order.orderItems, (line) => line.taxGhs)
    const installationTax = sum(order.orderItems, (line) => line.installationTaxGhs)
    return { ...order, goodsTax, installationTax, deliveryTax: order.taxGhs.minus(goodsTax).minus(installationTax) }
  })
  const refunds = rawRefunds.map((refund) => ({ at: refund.createdAt, tax: refundTax(refund) }))

  const refundGroups = new Map(byPeriod(range, refunds, (row) => row.at).map((group) => [group.key, group.rows]))
  const periods = byPeriod(range, orders, (order) => order.paidAt!).map((group): TaxPeriodRow => {
    const tax = sum(group.rows, (order) => order.taxGhs)
    const refunded = sum(refundGroups.get(group.key) ?? [], (row) => row.tax)
    return {
      key: group.key,
      label: group.label,
      paidOrders: group.rows.length,
      salesExTaxGhs: sum(group.rows, (order) => order.totalGhs.minus(order.taxGhs)).toFixed(2),
      goodsTaxGhs: sum(group.rows, (order) => order.goodsTax).toFixed(2),
      deliveryTaxGhs: sum(group.rows, (order) => order.deliveryTax).toFixed(2),
      installationTaxGhs: sum(group.rows, (order) => order.installationTax).toFixed(2),
      taxGhs: tax.toFixed(2),
      refundedTaxGhs: refunded.toFixed(2),
      netTaxGhs: tax.minus(refunded).toFixed(2),
    }
  })

  const rates = new Map<string, { rate: Prisma.Decimal; paidOrders: number; sales: Prisma.Decimal; tax: Prisma.Decimal }>()
  for (const order of orders) {
    const key = order.taxRate.toFixed(4)
    const row = rates.get(key) ?? { rate: order.taxRate, paidOrders: 0, sales: ZERO, tax: ZERO }
    rates.set(key, { ...row, paidOrders: row.paidOrders + 1, sales: row.sales.plus(order.totalGhs.minus(order.taxGhs)), tax: row.tax.plus(order.taxGhs) })
  }

  const tax = sum(orders, (order) => order.taxGhs)
  const refunded = sum(refunds, (row) => row.tax)
  return {
    summary: {
      salesExTaxGhs: sum(orders, (order) => order.totalGhs.minus(order.taxGhs)).toFixed(2),
      goodsTaxGhs: sum(orders, (order) => order.goodsTax).toFixed(2),
      deliveryTaxGhs: sum(orders, (order) => order.deliveryTax).toFixed(2),
      installationTaxGhs: sum(orders, (order) => order.installationTax).toFixed(2),
      taxGhs: tax.toFixed(2),
      refundedTaxGhs: refunded.toFixed(2),
      netTaxGhs: tax.minus(refunded).toFixed(2),
      paidOrders: orders.length,
      refunds: refunds.length,
    },
    periods,
    byRate: [...rates.values()]
      .sort((a, b) => b.rate.comparedTo(a.rate))
      .map((row) => ({ rate: row.rate.toFixed(4), paidOrders: row.paidOrders, salesExTaxGhs: row.sales.toFixed(2), taxGhs: row.tax.toFixed(2) })),
  }
}

// ---- Refunds and returns ----

export interface RefundsPeriodRow {
  key: string
  label: string
  refunds: number
  refundedGhs: string
  returns: number
  unitsReturned: number
}

export interface RefundRow {
  id: string
  at: Date
  reference: string
  href: string
  // The platform's only: the stores whose items are on the order
  stores: string | null
  amountGhs: string
  method: string
  reason: string
  by: string | null
  withReturn: boolean
}

export interface ReturnRow {
  id: string
  at: Date
  reference: string
  href: string
  stores: string | null
  reason: string
  units: number
  restocked: number
  refundGhs: string | null
  by: string | null
}

export interface ReturnedProductRow {
  id: string
  name: string
  href: string | null
  units: number
  restocked: number
}

export interface RefundsReport {
  summary: { refundedGhs: string; refunds: number; returns: number; unitsReturned: number; unitsRestocked: number }
  periods: RefundsPeriodRow[]
  // Newest first
  refunds: RefundRow[]
  returns: ReturnRow[]
  byProduct: ReturnedProductRow[]
}

// Refunds by when they were given and returns by when they were recorded, as the dashboard counts them. storeId: a
// store's own, on orders made only of its items (refunds and returns on shared orders are the platform's), or null
// for every order.
export async function getRefundsReport(tx: Tx, storeId: string | null, range: ReportRange): Promise<RefundsReport> {
  const ownOrder = storeId ? { order: { orderItems: { some: { organizationId: storeId }, every: { organizationId: storeId } } } } : {}
  const order = { select: { id: true, reference: true, orderItems: { select: { storeName: true } } } }
  const [refunds, returns] = await Promise.all([
    tx.orderRefund.findMany({
      where: { ...ownOrder, createdAt: within(range) },
      select: { id: true, createdAt: true, amountGhs: true, method: true, reason: true, refundedBy: { select: { name: true } }, return: { select: { id: true } }, order },
      orderBy: { createdAt: "desc" },
    }),
    tx.orderReturn.findMany({
      where: { ...ownOrder, createdAt: within(range) },
      select: {
        id: true,
        createdAt: true,
        reason: true,
        recordedBy: { select: { name: true } },
        refund: { select: { amountGhs: true } },
        items: { select: { quantity: true, restocked: true, orderItem: { select: { storeListingId: true, productId: true, productName: true } } } },
        order,
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const orderHref = (id: string) => (storeId ? `/store/orders/${id}/details` : `/orders/${id}/details`)
  const storeNames = (row: { order: { orderItems: { storeName: string }[] } }) => (storeId ? null : [...new Set(row.order.orderItems.map((line) => line.storeName))].join(", "))
  const units = (row: (typeof returns)[number]) => row.items.reduce((total, item) => total + item.quantity, 0)
  const restocked = (row: (typeof returns)[number]) => row.items.reduce((total, item) => total + (item.restocked ? item.quantity : 0), 0)

  const returnGroups = new Map(byPeriod(range, returns, (row) => row.createdAt).map((group) => [group.key, group.rows]))
  const periods = byPeriod(range, refunds, (row) => row.createdAt).map((group): RefundsPeriodRow => {
    const returned = returnGroups.get(group.key) ?? []
    return {
      key: group.key,
      label: group.label,
      refunds: group.rows.length,
      refundedGhs: sum(group.rows, (row) => row.amountGhs).toFixed(2),
      returns: returned.length,
      unitsReturned: returned.reduce((total, row) => total + units(row), 0),
    }
  })

  // A store's per listing, the platform's per catalogue product, as on the Sales report. The name is the latest return's.
  const products = new Map<string, ReturnedProductRow>()
  for (const row of [...returns].reverse()) {
    for (const item of row.items) {
      const line = item.orderItem
      const id = storeId ? line.storeListingId : (line.productId ?? line.storeListingId)
      const href = storeId ? listingHref(line.storeListingId) : line.productId ? catalogueProductHref(line.productId) : null
      const product = products.get(id) ?? { id, name: line.productName, href, units: 0, restocked: 0 }
      products.set(id, { ...product, name: line.productName, units: product.units + item.quantity, restocked: product.restocked + (item.restocked ? item.quantity : 0) })
    }
  }

  return {
    summary: {
      refundedGhs: sum(refunds, (row) => row.amountGhs).toFixed(2),
      refunds: refunds.length,
      returns: returns.length,
      unitsReturned: returns.reduce((total, row) => total + units(row), 0),
      unitsRestocked: returns.reduce((total, row) => total + restocked(row), 0),
    },
    periods,
    refunds: refunds.map((row) => ({
      id: row.id,
      at: row.createdAt,
      reference: row.order.reference,
      href: orderHref(row.order.id),
      stores: storeNames(row),
      amountGhs: row.amountGhs.toFixed(2),
      method: PAYMENT_METHOD_LABELS[row.method],
      reason: row.reason,
      by: row.refundedBy?.name ?? null,
      withReturn: row.return !== null,
    })),
    returns: returns.map((row) => ({
      id: row.id,
      at: row.createdAt,
      reference: row.order.reference,
      href: orderHref(row.order.id),
      stores: storeNames(row),
      reason: row.reason,
      units: units(row),
      restocked: restocked(row),
      refundGhs: row.refund?.amountGhs.toFixed(2) ?? null,
      by: row.recordedBy?.name ?? null,
    })),
    byProduct: [...products.values()].sort((a, b) => b.units - a.units || a.name.localeCompare(b.name)),
  }
}
