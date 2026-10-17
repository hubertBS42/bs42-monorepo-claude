import "server-only"

import type { OrdersData, OrdersParams } from "@/types"
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

    const { reference, customer, storeId, status, paymentStatus, multiStore, placedStart, placedEnd, page = 1, pageSize = 10, sort, order } = filters

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
          orderItems: { orderBy: { id: "asc" }, select: { quantity: true, storeName: true } },
        },
      }),
      prisma.order.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: orders.map(({ orderItems, totalGhs, ...order }) => ({
          ...order,
          totalGhs: totalGhs.toString(),
          itemCount: orderItems.reduce((sum, line) => sum + line.quantity, 0),
          storeNames: [...new Set(orderItems.map((line) => line.storeName))],
        })),
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
