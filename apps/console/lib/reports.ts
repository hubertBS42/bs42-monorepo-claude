import "server-only"

import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { describeVariant } from "@workspace/commerce/order-writes"
import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { Currency, OrderStatus, PaymentStatus, PurchaseOrderStatus } from "@workspace/db/enums"
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
      unitCostUsd: true,
      costEstimated: true,
      returns: { select: { quantity: true } },
      order: { select: { paidAt: true, exchangeRate: true } },
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

// ---- Profit and margins ----

export interface ProfitRow {
  id: string
  name: string
  href: string | null
  units: number
  // Every line's goods, and those of the lines with a cost, which profit and margin are worked out from
  goodsGhs: string
  costedGoodsGhs: string
  // Goods whose lines have no cost (no buy price at the sale), left out of profit and margin
  uncostedGoodsGhs: string
  costGhs: string
  // The part of the cost estimated rather than recorded at the sale (the old site's orders)
  estimatedCostGhs: string
  profitGhs: string
  // A fraction of the costed goods, or null with none
  margin: string | null
}

export interface ProfitPeriodRow extends Omit<ProfitRow, "id" | "name" | "href" | "units"> {
  key: string
  label: string
}

export interface ProfitReport {
  summary: Omit<ProfitRow, "id" | "name" | "href"> & {
    uncostedLines: number
    // Profit on the lines whose cost is estimated
    estimatedProfitGhs: string
  }
  periods: ProfitPeriodRow[]
  byProduct: ProfitRow[]
  byCategory: ProfitRow[]
  byBrand: ProfitRow[]
  // The platform's only
  byStore: ProfitRow[] | null
}

type ProfitLine = GoodsLine & { costGhs: Prisma.Decimal | null }

// Adds lines' goods, cost and profit up
function profitTotals(lines: ProfitLine[]) {
  let goods = ZERO
  let costedGoods = ZERO
  let cost = ZERO
  let estimatedCost = ZERO
  let estimatedGoods = ZERO
  for (const line of lines) {
    goods = goods.plus(line.goodsGhs)
    if (!line.costGhs) continue
    costedGoods = costedGoods.plus(line.goodsGhs)
    cost = cost.plus(line.costGhs)
    if (line.costEstimated) {
      estimatedCost = estimatedCost.plus(line.costGhs)
      estimatedGoods = estimatedGoods.plus(line.goodsGhs)
    }
  }
  const profit = costedGoods.minus(cost)
  return {
    units: lines.reduce((total, line) => total + line.units, 0),
    goods,
    estimatedProfit: estimatedGoods.minus(estimatedCost),
    row: {
      goodsGhs: goods.toFixed(2),
      costedGoodsGhs: costedGoods.toFixed(2),
      uncostedGoodsGhs: goods.minus(costedGoods).toFixed(2),
      costGhs: cost.toFixed(2),
      estimatedCostGhs: estimatedCost.toFixed(2),
      profitGhs: profit.toFixed(2),
      margin: costedGoods.gt(0) ? profit.dividedBy(costedGoods).toFixed(4) : null,
    },
  }
}

// The lines per group, the most profit first (then the most goods, for groups without a cost)
function groupProfit(lines: ProfitLine[], group: (line: ProfitLine) => { id: string; name: string; href: string | null }): ProfitRow[] {
  const groups = new Map<string, { id: string; name: string; href: string | null; latest: Date; lines: ProfitLine[] }>()
  for (const line of lines) {
    const { id, name, href } = group(line)
    const paidAt = line.order.paidAt!
    const row = groups.get(id)
    if (!row) groups.set(id, { id, name, href, latest: paidAt, lines: [line] })
    else {
      row.lines.push(line)
      // The latest sale's name, so a renamed product shows its current name
      if (paidAt > row.latest) Object.assign(row, { name, latest: paidAt })
    }
  }
  return [...groups.values()]
    .map((row) => ({ row, totals: profitTotals(row.lines) }))
    .sort((a, b) => new Prisma.Decimal(b.totals.row.profitGhs).comparedTo(a.totals.row.profitGhs) || b.totals.goods.comparedTo(a.totals.goods) || a.row.name.localeCompare(b.row.name))
    .map(({ row, totals }) => ({ id: row.id, name: row.name, href: row.href, units: totals.units, ...totals.row }))
}

// What goods sold for (as the sales report counts them) against what they cost: each line's unit cost (in USD, as
// buy prices are kept) at its order's exchange rate, for the units not returned. Lines without a cost are counted in
// the goods but left out of profit and margin.
export async function getProfitReport(tx: Tx, storeId: string | null, range: ReportRange): Promise<ProfitReport> {
  const rawLines = await goodsLines(tx, range, storeId)
  const lines: ProfitLine[] = rawLines.flatMap((line) => {
    const units = line.quantity - line.returns.reduce((total, row) => total + row.quantity, 0)
    if (units <= 0) return []
    const goodsGhs = line.totalPriceGhs.minus(line.discountGhs).times(units).dividedBy(line.quantity)
    const costGhs = line.unitCostUsd ? line.unitCostUsd.times(units).times(line.order.exchangeRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) : null
    return [{ ...line, units, goodsGhs, costGhs }]
  })

  const productIds = [...new Set(lines.flatMap((line) => (line.productId ? [line.productId] : [])))]
  const [products, categories] = await Promise.all([
    tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, categoryId: true, brand: { select: { id: true, name: true } } } }),
    tx.category.findMany({ select: { id: true, name: true, parentId: true } }),
  ])
  const productById = new Map(products.map((product) => [product.id, product]))
  const categoryPaths = getCategoryPaths(categories)
  const unknown = { id: "unknown", name: "Unknown", href: null }

  const totals = profitTotals(lines)

  return {
    summary: {
      units: totals.units,
      ...totals.row,
      uncostedLines: lines.filter((line) => !line.costGhs).length,
      estimatedProfitGhs: totals.estimatedProfit.toFixed(2),
    },
    periods: byPeriod(range, lines, (line) => line.order.paidAt!).map((group) => ({ key: group.key, label: group.label, ...profitTotals(group.rows).row })),
    byProduct: groupProfit(lines, (line) =>
      storeId
        ? { id: line.storeListingId, name: line.productName, href: listingHref(line.storeListingId) }
        : { id: line.productId ?? line.storeListingId, name: line.productName, href: line.productId ? catalogueProductHref(line.productId) : null }
    ),
    byCategory: groupProfit(lines, (line) => {
      const categoryId = productById.get(line.productId ?? "")?.categoryId
      return categoryId ? { id: categoryId, name: categoryPaths.get(categoryId) ?? "Unknown", href: null } : unknown
    }),
    byBrand: groupProfit(lines, (line) => {
      const brand = productById.get(line.productId ?? "")?.brand
      return brand ? { id: brand.id, name: brand.name, href: null } : { ...unknown, name: "No brand" }
    }),
    byStore: storeId ? null : groupProfit(lines, (line) => ({ id: line.organizationId, name: line.storeName, href: null })),
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

// ---- Stock value ----

export interface StockItemRow {
  id: string
  name: string
  variant: string | null
  // The platform's only
  store: string | null
  href: string
  units: number
  unitCostUsd: string | null
  costUsd: string | null
  retailUsd: string
}

export interface StockGroupRow {
  id: string
  name: string
  units: number
  costUsd: string
  retailUsd: string
  // Units in this group with no buy price, so left out of its cost
  unitsWithoutCost: number
}

export interface StockValueReport {
  // The latest USD→GHS rate, for the cedi figures; null when there's none
  rate: { rate: string; date: Date } | null
  summary: {
    units: number
    items: number
    costUsd: string
    costGhs: string | null
    retailUsd: string
    retailGhs: string | null
    itemsWithoutCost: number
    unitsWithoutCost: number
  }
  // The most valuable first
  items: StockItemRow[]
  byCategory: StockGroupRow[]
  byBrand: StockGroupRow[]
  byStore: StockGroupRow[] | null
}

// What's on the shelves now, at buy prices and at selling prices (before tax), in USD as prices are kept. A row counts
// as the listings table counts it: a product without variants by its listing's stock, one with variants by each
// variant's, whatever its status (the stock is there either way), when it tracks stock and has some. A variant
// without its own buy or sell price takes the listing's. There's no history of buy prices, so it's today's value only.
export async function getStockValueReport(tx: Tx, storeId: string | null): Promise<StockValueReport> {
  const [listings, categories, latestRate] = await Promise.all([
    tx.storeListing.findMany({
      where: storeId ? { organizationId: storeId } : {},
      select: {
        id: true,
        trackInventory: true,
        stock: true,
        buyPrice: true,
        sellPrice: true,
        organization: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, hasVariants: true, categoryId: true, brand: { select: { id: true, name: true } } } },
        storeListingVariants: {
          where: { trackInventory: true, stock: { gt: 0 } },
          select: {
            id: true,
            stock: true,
            buyPrice: true,
            sellPrice: true,
            variant: { select: { variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } } } },
          },
        },
      },
    }),
    tx.category.findMany({ select: { id: true, name: true, parentId: true } }),
    tx.exchangeRate.findFirst({ where: { from: "USD", to: "GHS" }, orderBy: { date: "desc" }, select: { rate: true, date: true } }),
  ])

  type Row = StockItemRow & { cost: Prisma.Decimal | null; retail: Prisma.Decimal; listing: (typeof listings)[number] }
  const rows: Row[] = listings.flatMap((listing) => {
    const make = (id: string, variant: string | null, units: number, buyPrice: Prisma.Decimal | null, sellPrice: Prisma.Decimal): Row => {
      const cost = buyPrice?.times(units) ?? null
      const retail = sellPrice.times(units)
      return {
        id,
        name: listing.product.name,
        variant,
        store: storeId ? null : listing.organization.name,
        href: storeId ? listingHref(listing.id) : catalogueProductHref(listing.product.id),
        units,
        unitCostUsd: buyPrice?.toFixed(2) ?? null,
        costUsd: cost?.toFixed(2) ?? null,
        retailUsd: retail.toFixed(2),
        cost,
        retail,
        listing,
      }
    }
    if (!listing.product.hasVariants) return listing.trackInventory && listing.stock > 0 ? [make(listing.id, null, listing.stock, listing.buyPrice, listing.sellPrice)] : []
    return listing.storeListingVariants.map((row) => make(row.id, describeVariant(row.variant.variantValues), row.stock, row.buyPrice ?? listing.buyPrice, row.sellPrice ?? listing.sellPrice))
  })

  const categoryPaths = getCategoryPaths(categories)
  const group = (key: (row: Row) => { id: string; name: string }): StockGroupRow[] => {
    const groups = new Map<string, { id: string; name: string; units: number; cost: Prisma.Decimal; retail: Prisma.Decimal; unitsWithoutCost: number }>()
    for (const row of rows) {
      const { id, name } = key(row)
      const entry = groups.get(id) ?? { id, name, units: 0, cost: ZERO, retail: ZERO, unitsWithoutCost: 0 }
      groups.set(id, {
        ...entry,
        units: entry.units + row.units,
        cost: entry.cost.plus(row.cost ?? ZERO),
        retail: entry.retail.plus(row.retail),
        unitsWithoutCost: entry.unitsWithoutCost + (row.cost ? 0 : row.units),
      })
    }
    return [...groups.values()]
      .sort((a, b) => b.cost.comparedTo(a.cost) || b.retail.comparedTo(a.retail) || a.name.localeCompare(b.name))
      .map(({ cost, retail, ...entry }) => ({ ...entry, costUsd: cost.toFixed(2), retailUsd: retail.toFixed(2) }))
  }

  const cost = sum(rows, (row) => row.cost ?? ZERO)
  const retail = sum(rows, (row) => row.retail)
  const toGhs = (usd: Prisma.Decimal) => (latestRate ? usd.times(latestRate.rate).toFixed(2) : null)
  const withoutCost = rows.filter((row) => !row.cost)

  return {
    rate: latestRate ? { rate: latestRate.rate.toString(), date: latestRate.date } : null,
    summary: {
      units: rows.reduce((total, row) => total + row.units, 0),
      items: rows.length,
      costUsd: cost.toFixed(2),
      costGhs: toGhs(cost),
      retailUsd: retail.toFixed(2),
      retailGhs: toGhs(retail),
      itemsWithoutCost: withoutCost.length,
      unitsWithoutCost: withoutCost.reduce((total, row) => total + row.units, 0),
    },
    items: [...rows]
      .sort((a, b) => (b.cost ?? ZERO).comparedTo(a.cost ?? ZERO) || b.retail.comparedTo(a.retail) || a.name.localeCompare(b.name))
      .map((row) => ({
        id: row.id,
        name: row.name,
        variant: row.variant,
        store: row.store,
        href: row.href,
        units: row.units,
        unitCostUsd: row.unitCostUsd,
        costUsd: row.costUsd,
        retailUsd: row.retailUsd,
      })),
    byCategory: group((row) => ({ id: row.listing.product.categoryId, name: categoryPaths.get(row.listing.product.categoryId) ?? "Unknown" })),
    byBrand: group((row) => row.listing.product.brand),
    byStore: storeId ? null : group((row) => row.listing.organization),
  }
}

// ---- Purchases by supplier ----

export interface PurchasesPeriodRow {
  key: string
  label: string
  ordersPlaced: number
  orderedUsd: string
  receivedUsd: string
}

export interface SupplierRow {
  id: string
  name: string
  // The platform's only: suppliers belong to a store
  store: string | null
  href: string | null
  ordersPlaced: number
  unitsOrdered: number
  orderedUsd: string
  unitsReceived: number
  receivedUsd: string
}

export interface PurchaseOrderRow {
  id: string
  orderedAt: Date
  reference: string
  href: string
  supplier: string
  store: string | null
  status: PurchaseOrderStatus
  currency: string
  totalUsd: string
}

export interface ReceivedProductRow {
  id: string
  name: string
  href: string
  units: number
  receivedUsd: string
}

export interface PurchasesReport {
  summary: { ordersPlaced: number; orderedUsd: string; shippingUsd: string; deliveries: number; unitsReceived: number; receivedUsd: string }
  periods: PurchasesPeriodRow[]
  suppliers: SupplierRow[]
  // Newest first
  orders: PurchaseOrderRow[]
  products: ReceivedProductRow[]
}

// What was bought in, in US dollars as buy prices are kept: an order in cedis takes each line's USD cost and its shipping
// at the rate it was ordered at. Ordered: purchase orders marked as ordered in the range, except those cancelled since
// (nothing came), goods and shipping. Received: what deliveries in the range brought, at each line's cost, goods only.
// storeId: a store's own, or null for every store's.
export async function getPurchasesReport(tx: Tx, storeId: string | null, range: ReportRange): Promise<PurchasesReport> {
  const inStore = storeId ? { organizationId: storeId } : {}
  const supplier = { select: { id: true, name: true } }
  const store = { select: { name: true } }
  const [ordered, receipts] = await Promise.all([
    tx.purchaseOrder.findMany({
      where: { ...inStore, orderedAt: within(range), status: { not: PurchaseOrderStatus.CANCELLED } },
      select: {
        id: true,
        reference: true,
        status: true,
        currency: true,
        exchangeRate: true,
        shippingCost: true,
        orderedAt: true,
        supplier,
        organization: store,
        items: { select: { quantityOrdered: true, unitCostUsd: true } },
      },
      orderBy: { orderedAt: "desc" },
    }),
    tx.purchaseOrderReceipt.findMany({
      where: { createdAt: within(range), purchaseOrder: inStore },
      select: {
        createdAt: true,
        purchaseOrder: { select: { supplier, organization: store } },
        items: { select: { quantity: true, purchaseOrderItem: { select: { storeListingId: true, productName: true, unitCostUsd: true, storeListing: { select: { productId: true } } } } } },
      },
    }),
  ])

  // An order in cedis has its rate from when it was marked as ordered, so every order here has one
  const shippingUsd = (order: (typeof ordered)[number]) =>
    order.currency === Currency.USD || !order.exchangeRate ? order.shippingCost : order.shippingCost.dividedBy(order.exchangeRate).toDecimalPlaces(2)
  const goodsUsd = (order: (typeof ordered)[number]) => sum(order.items, (item) => item.unitCostUsd.times(item.quantityOrdered))
  const orderUsd = (order: (typeof ordered)[number]) => goodsUsd(order).plus(shippingUsd(order))
  const receiptUsd = (receipt: (typeof receipts)[number]) => sum(receipt.items, (item) => item.purchaseOrderItem.unitCostUsd.times(item.quantity))
  const receiptUnits = (receipt: (typeof receipts)[number]) => receipt.items.reduce((total, item) => total + item.quantity, 0)

  const receiptGroups = new Map(byPeriod(range, receipts, (row) => row.createdAt).map((group) => [group.key, group.rows]))
  const periods = byPeriod(range, ordered, (order) => order.orderedAt!).map((group): PurchasesPeriodRow => ({
    key: group.key,
    label: group.label,
    ordersPlaced: group.rows.length,
    orderedUsd: sum(group.rows, orderUsd).toFixed(2),
    receivedUsd: sum(receiptGroups.get(group.key) ?? [], receiptUsd).toFixed(2),
  }))

  const suppliers = new Map<string, Omit<SupplierRow, "orderedUsd" | "receivedUsd"> & { ordered: Prisma.Decimal; received: Prisma.Decimal }>()
  const supplierRow = (row: { supplier: { id: string; name: string }; organization: { name: string } }) => {
    const entry = suppliers.get(row.supplier.id) ?? {
      id: row.supplier.id,
      name: row.supplier.name,
      store: storeId ? null : row.organization.name,
      href: storeId ? `/store/suppliers/${row.supplier.id}/edit` : null,
      ordersPlaced: 0,
      unitsOrdered: 0,
      ordered: ZERO,
      unitsReceived: 0,
      received: ZERO,
    }
    suppliers.set(row.supplier.id, entry)
    return entry
  }
  for (const order of ordered) {
    const entry = supplierRow(order)
    entry.ordersPlaced += 1
    entry.unitsOrdered += order.items.reduce((total, item) => total + item.quantityOrdered, 0)
    entry.ordered = entry.ordered.plus(orderUsd(order))
  }
  const products = new Map<string, { id: string; name: string; href: string; units: number; received: Prisma.Decimal }>()
  for (const receipt of receipts) {
    const entry = supplierRow(receipt.purchaseOrder)
    entry.unitsReceived += receiptUnits(receipt)
    entry.received = entry.received.plus(receiptUsd(receipt))
    for (const item of receipt.items) {
      const line = item.purchaseOrderItem
      // A store's per listing; the platform's per catalogue product, as on the Sales report
      const id = storeId ? line.storeListingId : line.storeListing.productId
      const href = storeId ? listingHref(line.storeListingId) : catalogueProductHref(line.storeListing.productId)
      const product = products.get(id) ?? { id, name: line.productName, href, units: 0, received: ZERO }
      products.set(id, { ...product, name: line.productName, units: product.units + item.quantity, received: product.received.plus(line.unitCostUsd.times(item.quantity)) })
    }
  }

  const orderedTotal = sum(ordered, orderUsd)
  const receivedTotal = sum(receipts, receiptUsd)
  return {
    summary: {
      ordersPlaced: ordered.length,
      orderedUsd: orderedTotal.toFixed(2),
      shippingUsd: sum(ordered, shippingUsd).toFixed(2),
      deliveries: receipts.length,
      unitsReceived: receipts.reduce((total, receipt) => total + receiptUnits(receipt), 0),
      receivedUsd: receivedTotal.toFixed(2),
    },
    periods,
    suppliers: [...suppliers.values()]
      .sort((a, b) => b.ordered.plus(b.received).comparedTo(a.ordered.plus(a.received)) || a.name.localeCompare(b.name))
      .map(({ ordered: orderedUsd, received, ...entry }) => ({ ...entry, orderedUsd: orderedUsd.toFixed(2), receivedUsd: received.toFixed(2) })),
    orders: ordered.map((order) => ({
      id: order.id,
      orderedAt: order.orderedAt!,
      reference: order.reference,
      href: storeId ? `/store/purchase-orders/${order.id}/details` : `/purchase-orders/${order.id}/details`,
      supplier: order.supplier.name,
      store: storeId ? null : order.organization.name,
      status: order.status,
      currency: order.currency,
      totalUsd: orderUsd(order).toFixed(2),
    })),
    products: [...products.values()]
      .sort((a, b) => b.received.comparedTo(a.received) || b.units - a.units || a.name.localeCompare(b.name))
      .map(({ received, ...product }) => ({ ...product, receivedUsd: received.toFixed(2) })),
  }
}
