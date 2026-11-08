import "server-only"

import type { StoreOrderDetails, StoreOrdersData, StoreOrdersParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { idsMatching, prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import type { DataResponse } from "@workspace/contracts"
import { returnLabel } from "@workspace/commerce/order-status"
import { dayStart } from "@workspace/utils/date"
import { getPaginationError } from "@workspace/utils/pagination"
import { toPhoneSearch } from "@workspace/utils/phone"
import { hasStorePermission } from "@/lib/auth-guard"
import { counterSaleWhere, paidByWhere } from "@/lib/counter-sales"
import { orderDetailsInclude, sumLines, toOrderAfterSale, toOrderDetailsBase, toOrderTotals, type OrderWithDetails } from "@/lib/order-details"

export const MAX_STORE_ORDERS_PAGE_SIZE = 100
// Not the total: for an order with other stores' items the table shows this store's share, which a sort can't follow
export const STORE_ORDER_SORT_FIELDS = ["reference", "createdAt", "status"] as const

async function checkOrderAccess(storeId: string): Promise<DataResponse<never> | undefined> {
  const session = await consoleAuth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: "Unauthorized" }
  if (!(await hasStorePermission(session.user.id, storeId, { order: ["read"] }))) return { success: false, error: "Forbidden" }
  return undefined
}

// Orders with at least one of the store's items
export const getStoreOrders = async (storeId: string, filters: StoreOrdersParams = {}): Promise<DataResponse<StoreOrdersData>> => {
  try {
    const denied = await checkOrderAccess(storeId)
    if (denied) return denied

    const paginationError = getPaginationError(filters, {
      maxPageSize: MAX_STORE_ORDERS_PAGE_SIZE,
      allowedSortFields: STORE_ORDER_SORT_FIELDS,
    })
    if (paginationError) {
      return { success: false, error: paginationError }
    }

    const { reference, customer, status, paymentStatus, counterSale, paidBy, multiStore, returned, trade, placedStart, placedEnd, page = 1, pageSize = 10, sort, order } = filters

    const [referenceIds, customerIds] = await Promise.all([
      reference ? idsMatching("order", ["reference"], reference) : null,
      // Phones are stored in international form, so a local "0244…" is searched as "+233244…" too
      customer ? idsMatching("order", ["customerName", "customerEmail", "customerPhone"], [customer, toPhoneSearch(customer)]) : null,
    ])
    // On an order shared with other stores, only this store's own lines count as its returns
    const ownReturnedLine = { organizationId: storeId, returns: { some: {} } }

    const where: Prisma.OrderWhereInput = {
      orderItems: { some: { organizationId: storeId } },
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
      ...(counterSale === true && counterSaleWhere),
      ...(counterSale === false && { NOT: counterSaleWhere }),
      ...(trade && { tradeCompanyName: trade === "true" ? { not: null } : null }),
      ...((placedStart || placedEnd) && {
        createdAt: {
          ...(placedStart && { gte: dayStart(placedStart) }),
          // The end day is included, so up to the start of the next one
          ...(placedEnd && { lt: dayStart(placedEnd, 1) }),
        },
      }),
      // In an AND, as these set fields used above: paymentStatus and orderItems
      AND: [
        ...(referenceIds ? [{ id: { in: referenceIds } }] : []),
        ...(customerIds ? [{ id: { in: customerIds } }] : []),
        ...(paidBy ? [paidByWhere(paidBy)] : []),
        ...(multiStore ? [{ orderItems: multiStore === "true" ? { some: { organizationId: { not: storeId } } } : { every: { organizationId: storeId } } }] : []),
        ...(returned ? [{ orderItems: returned === "true" ? { some: ownReturnedLine } : { none: ownReturnedLine } }] : []),
      ],
    }

    const direction = order === "desc" ? "desc" : "asc"
    // id breaks ties so rows with equal sort values keep their order across pages
    const orderBy: Prisma.OrderOrderByWithRelationInput[] = [sort ? { [sort]: direction } : { createdAt: "desc" }, { id: "asc" }]

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          reference: true,
          customerName: true,
          tradeCompanyName: true,
          status: true,
          paymentStatus: true,
          shippingMethod: true,
          totalGhs: true,
          createdAt: true,
          refunds: { select: { amountGhs: true } },
          orderItems: { select: { organizationId: true, quantity: true, totalPriceGhs: true, discountGhs: true, taxGhs: true, returns: { select: { quantity: true } } } },
        },
      }),
      prisma.order.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: orders.map(({ orderItems, totalGhs, refunds, ...order }) => {
          const ownLines = orderItems.filter((line) => line.organizationId === storeId)
          const isMultiStore = ownLines.length < orderItems.length
          const itemCount = ownLines.reduce((sum, line) => sum + line.quantity, 0)
          const returned = ownLines.reduce((sum, line) => sum + line.returns.reduce((total, row) => total + row.quantity, 0), 0)
          return {
            ...order,
            totalGhs: (isMultiStore ? sumLines(ownLines) : totalGhs).toString(),
            refundedGhs: !isMultiStore && refunds.length ? refunds.reduce((sum, row) => sum.plus(row.amountGhs), new Prisma.Decimal(0)).toFixed(2) : null,
            itemCount,
            returned: returnLabel(itemCount, returned),
            isMultiStore,
          }
        }),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Only this store's lines. The order's total and refunds cover other stores' items too, so a store sees them only for
// its own orders.
function toStoreOrderDetails(order: OrderWithDetails, storeId: string): StoreOrderDetails {
  const ownLines = order.orderItems.filter((line) => line.organizationId === storeId)
  const isMultiStore = ownLines.length < order.orderItems.length
  return {
    ...toOrderDetailsBase(order, ownLines, !isMultiStore, storeId),
    totals: isMultiStore ? null : toOrderTotals(order),
    storeTotalGhs: sumLines(ownLines).toString(),
    afterSale: isMultiStore ? null : toOrderAfterSale(order),
  }
}

export const getStoreOrderDetails = async (storeId: string, orderId: string): Promise<DataResponse<StoreOrderDetails>> => {
  try {
    const denied = await checkOrderAccess(storeId)
    if (denied) return denied

    const order = await prisma.order.findFirst({
      where: { id: orderId, orderItems: { some: { organizationId: storeId } } },
      include: orderDetailsInclude,
    })
    if (!order) return { success: false, error: "Order not found", code: "NOT_FOUND" }

    return { success: true, data: toStoreOrderDetails(order, storeId) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// The latest orders with the store's items, newest first, as the orders list sorts them
export const getRecentStoreOrderDetails = async (storeId: string, take: number): Promise<DataResponse<StoreOrderDetails[]>> => {
  try {
    const denied = await checkOrderAccess(storeId)
    if (denied) return denied

    const orders = await prisma.order.findMany({
      where: { orderItems: { some: { organizationId: storeId } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take,
      include: orderDetailsInclude,
    })

    return { success: true, data: orders.map((order) => toStoreOrderDetails(order, storeId)) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
