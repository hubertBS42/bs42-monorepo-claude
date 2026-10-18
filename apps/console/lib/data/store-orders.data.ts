import "server-only"

import type { StoreOrderDetails, StoreOrdersData, StoreOrdersParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { hasStorePermission } from "@/lib/auth-guard"
import { orderDetailsInclude, sumLines, toOrderAfterSale, toOrderDetailsBase, toOrderTotals } from "@/lib/order-details"

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

    const { reference, status, paymentStatus, page = 1, pageSize = 10, sort, order } = filters

    const where: Prisma.OrderWhereInput = {
      orderItems: { some: { organizationId: storeId } },
      ...(reference && { reference: { contains: reference, mode: "insensitive" } }),
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
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
          orderItems: { select: { organizationId: true, quantity: true, totalPriceGhs: true, discountGhs: true, taxGhs: true } },
        },
      }),
      prisma.order.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: orders.map(({ orderItems, totalGhs, ...order }) => {
          const ownLines = orderItems.filter((line) => line.organizationId === storeId)
          const isMultiStore = ownLines.length < orderItems.length
          return {
            ...order,
            totalGhs: (isMultiStore ? sumLines(ownLines) : totalGhs).toString(),
            itemCount: ownLines.reduce((sum, line) => sum + line.quantity, 0),
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

export const getStoreOrderDetails = async (storeId: string, orderId: string): Promise<DataResponse<StoreOrderDetails>> => {
  try {
    const denied = await checkOrderAccess(storeId)
    if (denied) return denied

    const order = await prisma.order.findFirst({
      where: { id: orderId, orderItems: { some: { organizationId: storeId } } },
      include: orderDetailsInclude,
    })
    if (!order) return { success: false, error: "Order not found", code: "NOT_FOUND" }

    const ownLines = order.orderItems.filter((line) => line.organizationId === storeId)
    const isMultiStore = ownLines.length < order.orderItems.length

    return {
      success: true,
      data: {
        // The order's total and refunds cover other stores' items too, so a store sees them only for its own orders
        ...toOrderDetailsBase(order, ownLines, !isMultiStore),
        totals: isMultiStore ? null : toOrderTotals(order),
        storeTotalGhs: sumLines(ownLines).toString(),
        afterSale: isMultiStore ? null : toOrderAfterSale(order),
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
