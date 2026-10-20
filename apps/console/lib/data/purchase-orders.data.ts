import "server-only"

import { headers } from "next/headers"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import type { DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { PurchaseOrderStatus } from "@workspace/db/enums"
import { getPaginationError } from "@workspace/utils/pagination"
import { hasStorePermission } from "@/lib/auth-guard"
import { getRateDate } from "@workspace/commerce/exchange-rates"
import { isOpenPurchaseOrder, OPEN_PURCHASE_ORDER_STATUSES } from "@/lib/purchase-order-status"
import type { PurchaseOrderDetails, PurchaseOrdersData, PurchaseOrdersParams, SelectItem } from "@/types"

export const MAX_PURCHASE_ORDERS_PAGE_SIZE = 100
// Not the total: it adds up lines, which a sort can't follow
export const PURCHASE_ORDER_SORT_FIELDS = ["reference", "createdAt", "status", "expectedOn"] as const

type Client = Pick<typeof prisma, "purchaseOrderItem">

async function checkAccess(storeId: string): Promise<DataResponse<never> | undefined> {
  const session = await consoleAuth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: "Unauthorized" }
  if (!(await hasStorePermission(session.user.id, storeId, { purchaseOrder: ["read"] }))) return { success: false, error: "Forbidden" }
  return undefined
}

// A plain day from a @db.Date (stored as midnight UTC)
const toDay = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null

// Open, and its expected day has passed (in the app's time zone, like the exchange-rate day)
const isOverdue = (status: PurchaseOrderStatus, expectedOn: Date | null) => isOpenPurchaseOrder(status) && !!expectedOn && toDay(expectedOn)! < getRateDate()

export const incomingKey = (listingId: string, listingVariantId: string | null) => `${listingId}:${listingVariantId ?? ""}`

// What's still to come on open purchase orders, per listing row (incomingKey). Not stored anywhere: ordered less
// received, over the orders that are ordered or partly received.
export async function getIncomingStock(client: Client, listingIds: string[]): Promise<Map<string, number>> {
  if (!listingIds.length) return new Map()
  const groups = await client.purchaseOrderItem.groupBy({
    by: ["storeListingId", "storeListingVariantId"],
    where: { storeListingId: { in: listingIds }, purchaseOrder: { status: { in: OPEN_PURCHASE_ORDER_STATUSES } } },
    _sum: { quantityOrdered: true, quantityReceived: true },
  })
  return new Map(groups.map((group) => [incomingKey(group.storeListingId, group.storeListingVariantId), (group._sum.quantityOrdered ?? 0) - (group._sum.quantityReceived ?? 0)]))
}

// The same, per listing (its variants added together), for the listings table
export async function getIncomingByListing(client: Client, listingIds: string[]): Promise<Map<string, number>> {
  if (!listingIds.length) return new Map()
  const groups = await client.purchaseOrderItem.groupBy({
    by: ["storeListingId"],
    where: { storeListingId: { in: listingIds }, purchaseOrder: { status: { in: OPEN_PURCHASE_ORDER_STATUSES } } },
    _sum: { quantityOrdered: true, quantityReceived: true },
  })
  return new Map(groups.map((group) => [group.storeListingId, (group._sum.quantityOrdered ?? 0) - (group._sum.quantityReceived ?? 0)]))
}

const sumLines = (lines: { quantityOrdered: number; unitCost: Prisma.Decimal }[]) => lines.reduce((sum, line) => sum.plus(line.unitCost.times(line.quantityOrdered)), new Prisma.Decimal(0))

export const getPurchaseOrders = async (storeId: string, filters: PurchaseOrdersParams = {}): Promise<DataResponse<PurchaseOrdersData>> => {
  try {
    const denied = await checkAccess(storeId)
    if (denied) return denied

    const paginationError = getPaginationError(filters, { maxPageSize: MAX_PURCHASE_ORDERS_PAGE_SIZE, allowedSortFields: PURCHASE_ORDER_SORT_FIELDS })
    if (paginationError) return { success: false, error: paginationError }

    const { reference, status, supplierId, page = 1, pageSize = 10, sort, order } = filters
    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId: storeId,
      ...(reference && { reference: { contains: reference, mode: "insensitive" } }),
      ...(status && { status }),
      ...(supplierId && { supplierId }),
    }

    const direction = order === "desc" ? "desc" : "asc"
    // id breaks ties so rows with equal sort values keep their order across pages
    const orderBy: Prisma.PurchaseOrderOrderByWithRelationInput[] = [sort ? { [sort]: direction } : { createdAt: "desc" }, { id: "asc" }]

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          reference: true,
          status: true,
          currency: true,
          shippingCost: true,
          expectedOn: true,
          createdAt: true,
          supplier: { select: { name: true } },
          items: { select: { quantityOrdered: true, quantityReceived: true, unitCost: true } },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: orders.map(({ items, supplier, shippingCost, expectedOn, ...order }) => ({
          ...order,
          supplierName: supplier.name,
          total: sumLines(items).plus(shippingCost).toFixed(2),
          quantityOrdered: items.reduce((sum, item) => sum + item.quantityOrdered, 0),
          quantityReceived: items.reduce((sum, item) => sum + item.quantityReceived, 0),
          expectedOn: toDay(expectedOn),
          isOverdue: isOverdue(order.status, expectedOn),
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

const label = (line: { productName: string; variantDescription: string | null }) => (line.variantDescription ? `${line.productName} (${line.variantDescription})` : line.productName)

export const getPurchaseOrderDetails = async (storeId: string, id: string): Promise<DataResponse<PurchaseOrderDetails>> => {
  try {
    const denied = await checkAccess(storeId)
    if (denied) return denied

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId: storeId },
      include: {
        supplier: { select: { id: true, name: true, contactName: true, email: true, phone: true, isArchived: true } },
        createdBy: { select: { name: true, email: true } },
        orderedBy: { select: { name: true, email: true } },
        closedBy: { select: { name: true, email: true } },
        items: {
          orderBy: { position: "asc" },
          include: {
            storeListing: { select: { stock: true, trackInventory: true } },
            storeListingVariant: { select: { stock: true, trackInventory: true } },
          },
        },
        receipts: {
          orderBy: { createdAt: "asc" },
          include: {
            receivedBy: { select: { name: true, email: true } },
            items: { select: { quantity: true, purchaseOrderItem: { select: { productName: true, variantDescription: true } } } },
          },
        },
      },
    })
    if (!order) return { success: false, error: "Purchase order not found", code: "NOT_FOUND" }

    const who = (user: { name: string | null; email: string } | null) => (user ? user.name || user.email : null)
    const subtotal = sumLines(order.items)

    return {
      success: true,
      data: {
        id: order.id,
        reference: order.reference,
        status: order.status,
        supplier: order.supplier,
        currency: order.currency,
        exchangeRate: order.exchangeRate?.toString() ?? null,
        shippingCost: order.shippingCost.toFixed(2),
        subtotal: subtotal.toFixed(2),
        total: subtotal.plus(order.shippingCost).toFixed(2),
        expectedOn: toDay(order.expectedOn),
        isOverdue: isOverdue(order.status, order.expectedOn),
        notes: order.notes,
        createdAt: order.createdAt,
        createdBy: who(order.createdBy),
        orderedAt: order.orderedAt,
        orderedBy: who(order.orderedBy),
        closedAt: order.closedAt,
        closedBy: who(order.closedBy),
        closeReason: order.closeReason,
        version: order.updatedAt.toISOString(),
        lines: order.items.map((item) => {
          const row = item.storeListingVariant ?? item.storeListing
          return {
            id: item.id,
            listingId: item.storeListingId,
            listingVariantId: item.storeListingVariantId,
            productName: item.productName,
            variantDescription: item.variantDescription,
            sku: item.sku,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: item.quantityReceived,
            unitCost: item.unitCost.toFixed(2),
            unitCostUsd: item.unitCostUsd.toFixed(2),
            total: item.unitCost.times(item.quantityOrdered).toFixed(2),
            stock: row.trackInventory ? row.stock : null,
          }
        }),
        receipts: order.receipts.map((receipt) => ({
          id: receipt.id,
          createdAt: receipt.createdAt,
          receivedBy: who(receipt.receivedBy),
          note: receipt.note,
          updatedBuyPrices: receipt.updatedBuyPrices,
          items: receipt.items.map((item) => ({ label: label(item.purchaseOrderItem), quantity: item.quantity })),
        })),
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// For the purchase order form's supplier select and the list's filter: the store's suppliers that aren't archived,
// plus the order's own (which a draft must then swap for another)
export const getSupplierOptions = async (storeId: string, includeId?: string): Promise<DataResponse<SelectItem[]>> => {
  try {
    const denied = await checkAccess(storeId)
    if (denied) return denied

    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: storeId, OR: [{ isArchived: false }, ...(includeId ? [{ id: includeId }] : [])] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isArchived: true },
    })
    return { success: true, data: suppliers.map((supplier) => ({ id: supplier.id, name: supplier.isArchived ? `${supplier.name} (archived)` : supplier.name })) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
