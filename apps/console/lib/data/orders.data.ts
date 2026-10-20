import "server-only"

import type { OrderDetails, OrdersData, OrdersParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import type { DataResponse } from "@workspace/contracts"
import { dayStart } from "@workspace/utils/date"
import { getPaginationError } from "@workspace/utils/pagination"
import { toPhoneSearch } from "@workspace/utils/phone"
import { z } from "zod"
import { orderDetailsInclude, toOrderAfterSale, toOrderDetailsBase, toOrderTotals, type OrderWithDetails } from "@/lib/order-details"
import { returnLabel } from "@workspace/commerce/order-status"

// The platform's orders: every order, whichever stores' items it has. Stores see theirs in store-orders.data.ts.

export const MAX_ORDERS_PAGE_SIZE = 100
export const ORDER_SORT_FIELDS = ["reference", "createdAt", "status", "totalGhs"] as const

async function checkOrderAccess(): Promise<DataResponse<never> | undefined> {
  const session = await consoleAuth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: "Unauthorized" }
  if (!hasSystemPermission(session.user.role, { order: ["read"] })) return { success: false, error: "Forbidden" }
  return undefined
}

// Orders with more than one store's items. Prisma can't count distinct related values in a filter, so the ids come
// from SQL; fine while the platform's orders number in the thousands.
async function getMultiStoreOrderIds() {
  const rows = await prisma.$queryRaw<{ orderId: string }[]>`
    SELECT "orderId" FROM "order_item" GROUP BY "orderId" HAVING COUNT(DISTINCT "organizationId") > 1`
  return rows.map((row) => row.orderId)
}

export const getOrders = async (filters: OrdersParams = {}): Promise<DataResponse<OrdersData>> => {
  try {
    const denied = await checkOrderAccess()
    if (denied) return denied

    const paginationError = getPaginationError(filters, {
      maxPageSize: MAX_ORDERS_PAGE_SIZE,
      allowedSortFields: ORDER_SORT_FIELDS,
    })
    if (paginationError) {
      return { success: false, error: paginationError }
    }

    const { reference, customer, storeId, status, paymentStatus, multiStore, returned, placedStart, placedEnd, page = 1, pageSize = 10, sort, order } = filters

    // The store id is a uuid column, so a malformed one (a hand-edited URL) would make Prisma throw: it matches nothing
    if (storeId && !z.uuid().safeParse(storeId).success) return { success: true, data: { data: [], total: 0, page, pageSize, totalPages: 0 } }

    const contains = (value: string) => ({ contains: value, mode: "insensitive" as const })
    // Phones are stored in international form, so a local "0244…" is searched as "+233244…" too
    const phoneSearch = customer ? toPhoneSearch(customer) : null
    const multiStoreIds = multiStore ? await getMultiStoreOrderIds() : []

    const where: Prisma.OrderWhereInput = {
      ...(reference && { reference: contains(reference) }),
      ...(customer && {
        OR: [{ customerName: contains(customer) }, { customerEmail: contains(customer) }, { customerPhone: contains(customer) }, ...(phoneSearch ? [{ customerPhone: contains(phoneSearch) }] : [])],
      }),
      ...(storeId && { orderItems: { some: { organizationId: storeId } } }),
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
      ...(multiStore && { id: multiStore === "true" ? { in: multiStoreIds } : { notIn: multiStoreIds } }),
      ...(returned && { returns: returned === "true" ? { some: {} } : { none: {} } }),
      ...((placedStart || placedEnd) && {
        createdAt: {
          ...(placedStart && { gte: dayStart(placedStart) }),
          // The end day is included, so up to the start of the next one
          ...(placedEnd && { lt: dayStart(placedEnd, 1) }),
        },
      }),
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
          status: true,
          paymentStatus: true,
          shippingMethod: true,
          totalGhs: true,
          createdAt: true,
          orderItems: { orderBy: { id: "asc" }, select: { quantity: true, storeName: true, returns: { select: { quantity: true } } } },
        },
      }),
      prisma.order.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: orders.map(({ orderItems, totalGhs, ...order }) => {
          const itemCount = orderItems.reduce((sum, line) => sum + line.quantity, 0)
          const returned = orderItems.reduce((sum, line) => sum + line.returns.reduce((total, row) => total + row.quantity, 0), 0)
          return {
            ...order,
            totalGhs: totalGhs.toString(),
            itemCount,
            storeNames: [...new Set(orderItems.map((line) => line.storeName))],
            returned: returnLabel(itemCount, returned),
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

function toOrderDetails(order: OrderWithDetails): OrderDetails {
  return {
    ...toOrderDetailsBase(order, order.orderItems, true),
    totals: toOrderTotals(order),
    storeNames: [...new Set(order.orderItems.map((line) => line.storeName))],
    ...toOrderAfterSale(order),
  }
}

export const getOrderDetails = async (orderId: string): Promise<DataResponse<OrderDetails>> => {
  try {
    const denied = await checkOrderAccess()
    if (denied) return denied

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderDetailsInclude })
    if (!order) return { success: false, error: "Order not found", code: "NOT_FOUND" }

    return { success: true, data: toOrderDetails(order) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// The latest orders, newest first, as the orders list sorts them
export const getRecentOrderDetails = async (take: number): Promise<DataResponse<OrderDetails[]>> => {
  try {
    const denied = await checkOrderAccess()
    if (denied) return denied

    const orders = await prisma.order.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }], take, include: orderDetailsInclude })

    return { success: true, data: orders.map(toOrderDetails) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
