import "server-only"

import type { StoreOrderDetails, StoreOrdersData, StoreOrdersParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { formatCurrency } from "@workspace/utils/currency"
import { hasStorePermission } from "@/lib/auth-guard"
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/order-status"

export const MAX_STORE_ORDERS_PAGE_SIZE = 100
// Not the total: for an order with other stores' items the table shows this store's share, which a sort can't follow
export const STORE_ORDER_SORT_FIELDS = ["reference", "createdAt", "status"] as const

async function checkOrderAccess(storeId: string): Promise<DataResponse<never> | undefined> {
  const session = await consoleAuth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: "Unauthorized" }
  if (!(await hasStorePermission(session.user.id, storeId, { order: ["read"] }))) return { success: false, error: "Forbidden" }
  return undefined
}

// Staff of other stores and the platform can appear on an order, so a missing name never falls back to their email
function staffName(user: { name: string | null } | null) {
  return user ? (user.name ?? "Staff") : null
}

// A line as the customer pays for it: after its share of the discount, with its tax
function lineTotal(line: { totalPriceGhs: Prisma.Decimal; discountGhs: Prisma.Decimal; taxGhs: Prisma.Decimal }) {
  return line.totalPriceGhs.minus(line.discountGhs).plus(line.taxGhs)
}

function sumLines(lines: { totalPriceGhs: Prisma.Decimal; discountGhs: Prisma.Decimal; taxGhs: Prisma.Decimal }[]) {
  return lines.reduce((sum, line) => sum.plus(lineTotal(line)), new Prisma.Decimal(0))
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
      include: {
        orderItems: { orderBy: { id: "asc" } },
        statusHistory: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { name: true } } } },
        createdBy: { select: { name: true } },
        paymentRecordedBy: { select: { name: true } },
      },
    })
    if (!order) return { success: false, error: "Order not found", code: "NOT_FOUND" }

    const ownLines = order.orderItems.filter((line) => line.organizationId === storeId)
    const isMultiStore = ownLines.length < order.orderItems.length

    return {
      success: true,
      data: {
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
        lines: ownLines.map((line) => ({
          id: line.id,
          productName: line.productName,
          variantDescription: line.variantDescription,
          sku: line.sku,
          productImage: line.productImage,
          quantity: line.quantity,
          unitPriceGhs: line.unitPriceGhs.toString(),
          totalPriceGhs: line.totalPriceGhs.toString(),
          discountGhs: line.discountGhs.toString(),
          taxGhs: line.taxGhs.toString(),
        })),
        isMultiStore,
        // Shipping and the order's totals cover other stores' items too, so a store sees them only for its own orders
        totals: isMultiStore
          ? null
          : {
              subtotalGhs: order.subtotalGhs.toString(),
              discountType: order.discountType,
              discountValue: order.discountValue?.toString() ?? null,
              discountAmountGhs: order.discountAmountGhs?.toString() ?? null,
              discountReason: order.discountReason,
              shippingGhs: order.shippingGhs.toString(),
              taxRate: order.taxRate.toString(),
              taxGhs: order.taxGhs.toString(),
              totalGhs: order.totalGhs.toString(),
            },
        storeTotalGhs: sumLines(ownLines).toString(),
        exchangeRate: order.exchangeRate.toString(),
        createdBy: staffName(order.createdBy),
        createdAt: order.createdAt,
        timeline: [
          ...order.statusHistory.map((entry) => ({
            id: entry.id,
            title: ORDER_STATUS_LABELS[entry.status],
            note: entry.note,
            changedBy: staffName(entry.changedBy),
            createdAt: entry.createdAt,
          })),
          // The order's total covers other stores' items too, so a store sees the amount only for its own orders
          ...(order.paidAt
            ? [
                {
                  id: "payment",
                  title: "Payment recorded",
                  note: isMultiStore
                    ? PAYMENT_METHOD_LABELS[order.paymentMethod]
                    : `${formatCurrency(order.totalGhs.toString(), "GHS", "en-GH")} by ${PAYMENT_METHOD_LABELS[order.paymentMethod].toLowerCase()}`,
                  changedBy: staffName(order.paymentRecordedBy),
                  createdAt: order.paidAt,
                },
              ]
            : []),
        ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
