import "server-only"

import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { CollectionTransferStatus, OrderStatus } from "@workspace/db/enums"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { formatError } from "@workspace/auth/format-error"
import { hasStorePermission } from "@/lib/auth-guard"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { orderDetailsInclude, toCollection } from "@/lib/order-details"
import type { CollectionDetails, CollectionListItem } from "@/types"
import type { PaginatedResult } from "@workspace/contracts"

// Orders customers collect at the store's branch (Order.pickupLocation), whichever stores' items they hold: for any role
// there to receive what other branches send, tell the customer, and hand over. Everything on the order, as it's what's
// handed over, but no costs.

export const COLLECTION_VIEWS = ["open", "collected"] as const
export type CollectionView = (typeof COLLECTION_VIEWS)[number]
export const MAX_COLLECTIONS_PAGE_SIZE = 100
const OPEN: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING]

async function checkAccess(storeId: string): Promise<DataResponse<never> | undefined> {
  const session = await consoleAuth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: "Unauthorized" }
  if (!(await hasStorePermission(session.user.id, storeId, { order: ["read"] }))) return { success: false, error: "Forbidden" }
  return undefined
}

// The state a branch cares about: items still coming, everything here, the customer told, or collected
function stateOf(order: {
  status: OrderStatus
  readyForCollectionAt: Date | null
  pickupLocation: { organizationId: string } | null
  orderItems: { organizationId: string }[]
  collectionTransfers: { fromStoreId: string; status: CollectionTransferStatus }[]
}): CollectionListItem["state"] {
  if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) return "collected"
  if (order.readyForCollectionAt) return "ready"
  const here = order.pickupLocation?.organizationId
  const arrived = new Set([here, ...order.collectionTransfers.filter((transfer) => transfer.status === CollectionTransferStatus.RECEIVED).map((transfer) => transfer.fromStoreId)])
  return order.orderItems.every((line) => arrived.has(line.organizationId)) ? "here" : "coming"
}

export async function getStoreCollections(storeId: string, params: { view?: CollectionView; page?: number; pageSize?: number }): Promise<DataResponse<PaginatedResult<CollectionListItem>>> {
  try {
    const denied = await checkAccess(storeId)
    if (denied) return denied
    const paginationError = getPaginationError(params, { maxPageSize: MAX_COLLECTIONS_PAGE_SIZE, allowedSortFields: [] })
    if (paginationError) return { success: false, error: paginationError }
    const { view = "open", page = 1, pageSize = 25 } = params

    const where: Prisma.OrderWhereInput = {
      pickupLocation: { organizationId: storeId },
      status: view === "open" ? { in: OPEN } : { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
    }
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        // Oldest first while waiting; most recent first once collected
        orderBy: [{ createdAt: view === "open" ? "asc" : "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          reference: true,
          customerName: true,
          status: true,
          paymentStatus: true,
          readyForCollectionAt: true,
          createdAt: true,
          pickupLocation: { select: { organizationId: true } },
          orderItems: { select: { organizationId: true, quantity: true } },
          collectionTransfers: { where: { status: { not: CollectionTransferStatus.CANCELLED } }, select: { fromStoreId: true, status: true } },
        },
      }),
      prisma.order.count({ where }),
    ])
    return {
      success: true,
      data: {
        data: orders.map((order) => ({
          id: order.id,
          reference: order.reference,
          customerName: order.customerName,
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          itemCount: order.orderItems.reduce((sum, line) => sum + line.quantity, 0),
          state: stateOf(order),
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

export async function getCollectionDetails(storeId: string, orderId: string): Promise<DataResponse<CollectionDetails>> {
  try {
    const denied = await checkAccess(storeId)
    if (denied) return denied
    const order = await prisma.order.findFirst({ where: { id: orderId, pickupLocation: { organizationId: storeId } }, include: orderDetailsInclude })
    if (!order) return { success: false, error: "Order not found", code: "NOT_FOUND" }
    return {
      success: true,
      data: {
        id: order.id,
        reference: order.reference,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalGhs: order.totalGhs.toString(),
        createdAt: order.createdAt,
        readyForCollectionAt: order.readyForCollectionAt,
        customer: { name: order.customerName, email: order.customerEmail, phone: order.customerPhone },
        notes: order.notes,
        lines: order.orderItems.map((line) => ({
          id: line.id,
          label: line.variantDescription ? `${line.productName} (${line.variantDescription})` : line.productName,
          sku: line.sku,
          quantity: line.quantity,
          storeName: line.organizationId === storeId ? null : line.storeName,
        })),
        collection: toCollection(order),
        state: stateOf(order),
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
