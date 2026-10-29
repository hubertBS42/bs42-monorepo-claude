import "server-only"

import { headers } from "next/headers"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import type { DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { PurchaseOrderStatus, Status, StockTransferStatus } from "@workspace/db/enums"
import { getPaginationError } from "@workspace/utils/pagination"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { hasStorePermission } from "@/lib/auth-guard"
import { getRateDate } from "@workspace/commerce/exchange-rates"
import { catalogueProductHref, listingHref } from "@/lib/product-links"
import { isOpenPurchaseOrder, OPEN_PURCHASE_ORDER_STATUSES, overduePurchaseOrderWhere } from "@/lib/purchase-order-status"
import type { PurchasableListing, PurchaseOrderDetails, PurchaseOrdersData, PurchaseOrdersParams, SelectItem } from "@/types"

export const MAX_PURCHASE_ORDERS_PAGE_SIZE = 100
// Not the total: it adds up lines, which a sort can't follow
export const PURCHASE_ORDER_SORT_FIELDS = ["reference", "createdAt", "status", "expectedOn"] as const

type Client = Pick<typeof prisma, "purchaseOrderItem" | "stockTransferItem">

// A store's own staff (purchaseOrder: read in that store), or, with storeId null, the platform's read-only view of every
// store's, for system admins
async function checkAccess(storeId: string | null): Promise<DataResponse<never> | undefined> {
  const session = await consoleAuth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: "Unauthorized" }
  const allowed = storeId ? await hasStorePermission(session.user.id, storeId, { purchaseOrder: ["read"] }) : hasSystemRole(session.user.role, consoleAdminRoles)
  if (!allowed) return { success: false, error: "Forbidden" }
  return undefined
}

// A plain day from a @db.Date (stored as midnight UTC)
const toDay = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null

// Open, and its expected day has passed (in the app's time zone, like the exchange-rate day)
const isOverdue = (status: PurchaseOrderStatus, expectedOn: Date | null) => isOpenPurchaseOrder(status) && !!expectedOn && toDay(expectedOn)! < getRateDate()

export const incomingKey = (listingId: string, listingVariantId: string | null) => `${listingId}:${listingVariantId ?? ""}`

// Adds n to a key's count
const addTo = (counts: Map<string, number>, key: string, n: number) => counts.set(key, (counts.get(key) ?? 0) + n)

// What's still to come, per listing row (incomingKey): on open purchase orders (ordered less received, over the orders
// that are ordered or partly received) and on transfers sent to the store and not yet received. Not stored anywhere.
// The storefront's "Due" lines count purchase orders only (they have an expected day).
export async function getIncomingStock(client: Client, listingIds: string[]): Promise<Map<string, number>> {
  if (!listingIds.length) return new Map()
  const [ordered, inTransit] = await Promise.all([
    client.purchaseOrderItem.groupBy({
      by: ["storeListingId", "storeListingVariantId"],
      where: { storeListingId: { in: listingIds }, purchaseOrder: { status: { in: OPEN_PURCHASE_ORDER_STATUSES } } },
      _sum: { quantityOrdered: true, quantityReceived: true },
    }),
    client.stockTransferItem.groupBy({
      by: ["toListingId", "toListingVariantId"],
      where: { toListingId: { in: listingIds }, transfer: { status: StockTransferStatus.SENT } },
      _sum: { quantity: true },
    }),
  ])
  const counts = new Map<string, number>()
  for (const group of ordered) addTo(counts, incomingKey(group.storeListingId, group.storeListingVariantId), (group._sum.quantityOrdered ?? 0) - (group._sum.quantityReceived ?? 0))
  for (const group of inTransit) addTo(counts, incomingKey(group.toListingId, group.toListingVariantId), group._sum.quantity ?? 0)
  return counts
}

// The same, per listing (its variants added together), for the listings table
export async function getIncomingByListing(client: Client, listingIds: string[]): Promise<Map<string, number>> {
  if (!listingIds.length) return new Map()
  const [ordered, inTransit] = await Promise.all([
    client.purchaseOrderItem.groupBy({
      by: ["storeListingId"],
      where: { storeListingId: { in: listingIds }, purchaseOrder: { status: { in: OPEN_PURCHASE_ORDER_STATUSES } } },
      _sum: { quantityOrdered: true, quantityReceived: true },
    }),
    client.stockTransferItem.groupBy({ by: ["toListingId"], where: { toListingId: { in: listingIds }, transfer: { status: StockTransferStatus.SENT } }, _sum: { quantity: true } }),
  ])
  const counts = new Map<string, number>()
  for (const group of ordered) addTo(counts, group.storeListingId, (group._sum.quantityOrdered ?? 0) - (group._sum.quantityReceived ?? 0))
  for (const group of inTransit) addTo(counts, group.toListingId, group._sum.quantity ?? 0)
  return counts
}

const sumLines = (lines: { quantityOrdered: number; unitCost: Prisma.Decimal }[]) => lines.reduce((sum, line) => sum.plus(line.unitCost.times(line.quantityOrdered)), new Prisma.Decimal(0))

// One store's, or every store's (storeId null, the platform's view, which can filter by store)
export const getPurchaseOrders = async (storeId: string | null, filters: PurchaseOrdersParams = {}): Promise<DataResponse<PurchaseOrdersData>> => {
  try {
    const denied = await checkAccess(storeId)
    if (denied) return denied

    const paginationError = getPaginationError(filters, { maxPageSize: MAX_PURCHASE_ORDERS_PAGE_SIZE, allowedSortFields: PURCHASE_ORDER_SORT_FIELDS })
    if (paginationError) return { success: false, error: paginationError }

    const { reference, status, supplierId, overdue, page = 1, pageSize = 10, sort, order } = filters
    // A store's list is always its own; the platform's can filter by store
    const organizationId = storeId ?? filters.storeId
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(organizationId && { organizationId }),
      ...(reference && { reference: { contains: reference, mode: "insensitive" } }),
      ...(supplierId && { supplierId }),
      // Overdue sets the statuses it allows; a status filter narrows them further
      AND: [...(status ? [{ status }] : []), ...(overdue ? [overduePurchaseOrderWhere(getRateDate())] : [])],
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
          organization: { select: { name: true } },
          supplier: { select: { name: true } },
          items: { select: { quantityOrdered: true, quantityReceived: true, unitCost: true } },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: orders.map(({ items, organization, supplier, shippingCost, expectedOn, ...order }) => ({
          ...order,
          storeName: organization.name,
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

// One of a store's, or any store's (storeId null, the platform's read-only view)
export const getPurchaseOrderDetails = async (storeId: string | null, id: string): Promise<DataResponse<PurchaseOrderDetails>> => {
  try {
    const denied = await checkAccess(storeId)
    if (denied) return denied

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, ...(storeId && { organizationId: storeId }) },
      include: {
        organization: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true, contactName: true, email: true, phone: true, isArchived: true } },
        createdBy: { select: { name: true, email: true } },
        orderedBy: { select: { name: true, email: true } },
        closedBy: { select: { name: true, email: true } },
        items: {
          orderBy: { position: "asc" },
          include: {
            storeListing: { select: { stock: true, trackInventory: true, productId: true } },
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
        store: order.organization,
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
            href: storeId ? listingHref(item.storeListingId) : catalogueProductHref(item.storeListing.productId),
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

// Also the most the create page takes from the listings table's selection (?listings=)
export const MAX_PURCHASABLE_LISTINGS = 30

// The store's listings that can be bought in (not archived), matching a search or given ids, with their stock, what's
// already on its way and the last buy price as a starting cost. The caller checks the store role.
export async function findPurchasableListings(storeId: string, { search, listingIds }: { search?: string; listingIds?: string[] }): Promise<PurchasableListing[]> {
  const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
  const listings = await prisma.storeListing.findMany({
    where: {
      organizationId: storeId,
      status: { not: Status.ARCHIVED },
      ...(listingIds && { id: { in: listingIds } }),
      ...(contains && { product: { OR: [{ name: contains }, { sku: contains }, { variants: { some: { sku: contains } } }] } }),
    },
    orderBy: [{ product: { name: "asc" } }, { id: "asc" }],
    take: MAX_PURCHASABLE_LISTINGS,
    select: {
      id: true,
      buyPrice: true,
      stock: true,
      trackInventory: true,
      lowStockThreshold: true,
      product: { select: { name: true, sku: true, images: true, hasVariants: true, baseBuyPrice: true, brand: { select: { name: true } } } },
      storeListingVariants: {
        where: { variant: { status: { not: Status.ARCHIVED } } },
        orderBy: [{ variant: { position: "asc" } }],
        select: {
          id: true,
          buyPrice: true,
          stock: true,
          trackInventory: true,
          variant: { select: { sku: true, variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } } } },
        },
      },
    },
  })
  const incoming = await getIncomingStock(
    prisma,
    listings.map((listing) => listing.id)
  )

  return listings.flatMap((listing) => {
    const { product } = listing
    const fallbackCost = listing.buyPrice ?? (product.baseBuyPrice.isZero() ? null : product.baseBuyPrice)
    const rows = product.hasVariants
      ? listing.storeListingVariants.map((row) => {
          const values = [...row.variant.variantValues].sort((a, b) => a.optionValue.option.position - b.optionValue.option.position)
          return {
            listingVariantId: row.id,
            variantDescription: values.map(({ optionValue }) => `${optionValue.option.name}: ${optionValue.value}`).join(" / "),
            sku: row.variant.sku,
            buyPriceUsd: (row.buyPrice ?? fallbackCost)?.toFixed(2) ?? null,
            stock: row.trackInventory ? row.stock : null,
            incoming: incoming.get(incomingKey(listing.id, row.id)) ?? 0,
          }
        })
      : [
          {
            listingVariantId: null,
            variantDescription: null,
            sku: product.sku,
            buyPriceUsd: fallbackCost?.toFixed(2) ?? null,
            stock: listing.trackInventory ? listing.stock : null,
            incoming: incoming.get(incomingKey(listing.id, null)) ?? 0,
          },
        ]
    return rows.length
      ? [{ listingId: listing.id, productName: product.name, brandName: product.brand.name, image: product.images[0] ?? null, lowStockThreshold: listing.lowStockThreshold, rows }]
      : []
  })
}
