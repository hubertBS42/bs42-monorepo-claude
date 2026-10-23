import "server-only"

import { headers } from "next/headers"
import { consoleAuth } from "@workspace/auth/console"
import { formatError } from "@workspace/auth/format-error"
import { describeVariant } from "@workspace/commerce/order-writes"
import { PLATFORM_ORGANIZATION_SLUG, type DataResponse, type PaginatedResult } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { Status } from "@workspace/db/enums"
import { getStoreRole } from "@/lib/auth-guard"
import { TRANSFER_ROLES } from "@/lib/stock-transfer-status"
import type { SelectItem, StockTransferDetails, StockTransferListItem, StockTransfersParams, TransferableRow } from "@/types"

export const MAX_STOCK_TRANSFERS_PAGE_SIZE = 100

async function getSession() {
  return consoleAuth.api.getSession({ headers: await headers() })
}

// Any member of the store can see its transfers, both ways
async function checkMember(storeId: string) {
  const session = await getSession()
  if (!session) return { success: false as const, error: "Unauthorized" }
  if (!(await getStoreRole(session.user.id, storeId))) return { success: false as const, error: "Forbidden" }
  return null
}

const personName = (user: { name: string | null; email: string } | null) => (user ? user.name || user.email : null)

export const getStockTransfers = async (storeId: string, { direction, status, page = 1, pageSize = 10 }: StockTransfersParams): Promise<DataResponse<PaginatedResult<StockTransferListItem>>> => {
  try {
    const denied = await checkMember(storeId)
    if (denied) return denied
    if (pageSize > MAX_STOCK_TRANSFERS_PAGE_SIZE) return { success: false, error: "Page size too large" }

    const where: Prisma.StockTransferWhereInput = {
      ...(direction === "out" ? { fromStoreId: storeId } : direction === "in" ? { toStoreId: storeId } : { OR: [{ fromStoreId: storeId }, { toStoreId: storeId }] }),
      ...(status && { status }),
    }
    const [rows, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          reference: true,
          status: true,
          createdAt: true,
          fromStoreId: true,
          fromStore: { select: { name: true } },
          toStore: { select: { name: true } },
          sentBy: { select: { name: true, email: true } },
          items: { select: { quantity: true, quantityReceived: true } },
        },
      }),
      prisma.stockTransfer.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: rows.map((row) => {
          const out = row.fromStoreId === storeId
          return {
            id: row.id,
            reference: row.reference,
            direction: out ? "out" : "in",
            otherStoreName: out ? row.toStore.name : row.fromStore.name,
            status: row.status,
            lines: row.items.length,
            units: row.items.reduce((sum, item) => sum + item.quantity, 0),
            unitsReceived: row.status === "RECEIVED" ? row.items.reduce((sum, item) => sum + (item.quantityReceived ?? 0), 0) : null,
            sentBy: personName(row.sentBy),
            createdAt: row.createdAt,
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

// A transfer this store sent or was sent
export const getStockTransferDetails = async (storeId: string, transferId: string): Promise<DataResponse<StockTransferDetails>> => {
  try {
    const denied = await checkMember(storeId)
    if (denied) return denied

    const row = await prisma.stockTransfer.findFirst({
      where: { id: transferId, OR: [{ fromStoreId: storeId }, { toStoreId: storeId }] },
      select: {
        id: true,
        reference: true,
        status: true,
        notes: true,
        createdAt: true,
        receivedAt: true,
        receiveNote: true,
        cancelledAt: true,
        cancelReason: true,
        fromStore: { select: { id: true, name: true } },
        toStore: { select: { id: true, name: true } },
        sentBy: { select: { name: true, email: true } },
        receivedBy: { select: { name: true, email: true } },
        cancelledBy: { select: { name: true, email: true } },
        items: {
          orderBy: { position: "asc" },
          select: { id: true, productName: true, variantDescription: true, sku: true, quantity: true, quantityReceived: true, fromListingId: true, toListingId: true },
        },
      },
    })
    if (!row) return { success: false, error: "Transfer not found.", code: "NOT_FOUND" }

    const { sentBy, receivedBy, cancelledBy, ...transfer } = row
    return {
      success: true,
      data: {
        ...transfer,
        direction: row.fromStore.id === storeId ? "out" : "in",
        sentBy: personName(sentBy),
        receivedBy: personName(receivedBy),
        cancelledBy: personName(cancelledBy),
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// The stores a user can send to from this one: the others they manage (owner or admin), which for platform admins is
// every store
export const getTransferDestinations = async (userId: string, fromStoreId: string): Promise<SelectItem[]> => {
  const members = await prisma.member.findMany({
    where: { userId, role: { in: [...TRANSFER_ROLES] }, organizationId: { not: fromStoreId }, organization: { slug: { not: PLATFORM_ORGANIZATION_SLUG } } },
    select: { organization: { select: { id: true, name: true } } },
    orderBy: { organization: { name: "asc" } },
  })
  return members.map(({ organization }) => organization)
}

const ROWS_SHOWN = 30

// The sender's rows matching a search (product name or SKU) that track stock and have some, a row per variant, with
// whether the chosen store lists the same product (and variant)
export async function findTransferableRows(fromStoreId: string, toStoreId: string | null, search: string): Promise<TransferableRow[]> {
  const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
  const listings = await prisma.storeListing.findMany({
    where: {
      organizationId: fromStoreId,
      status: { not: Status.ARCHIVED },
      ...(contains && { product: { OR: [{ name: contains }, { sku: contains }, { variants: { some: { sku: contains } } }] } }),
      OR: [
        { trackInventory: true, stock: { gt: 0 }, product: { hasVariants: false } },
        { product: { hasVariants: true }, storeListingVariants: { some: { trackInventory: true, stock: { gt: 0 }, variant: { status: { not: Status.ARCHIVED } } } } },
      ],
    },
    orderBy: { product: { name: "asc" } },
    take: ROWS_SHOWN,
    select: {
      id: true,
      stock: true,
      productId: true,
      product: { select: { name: true, sku: true, images: true, hasVariants: true } },
      storeListingVariants: {
        where: { trackInventory: true, stock: { gt: 0 }, variant: { status: { not: Status.ARCHIVED } } },
        orderBy: { variant: { position: "asc" } },
        select: {
          id: true,
          stock: true,
          variantId: true,
          variant: { select: { sku: true, variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } } } },
        },
      },
    },
  })

  const targets = toStoreId
    ? await prisma.storeListing.findMany({
        where: { organizationId: toStoreId, productId: { in: listings.map((listing) => listing.productId) }, status: { not: Status.ARCHIVED } },
        select: { productId: true, storeListingVariants: { select: { variantId: true } } },
      })
    : []
  const listedVariants = new Map(targets.map((listing) => [listing.productId, new Set(listing.storeListingVariants.map((row) => row.variantId))]))
  const listed = (productId: string, variantId: string | null) => (toStoreId ? (variantId ? !!listedVariants.get(productId)?.has(variantId) : listedVariants.has(productId)) : null)

  return listings.flatMap((listing): TransferableRow[] => {
    const base = { listingId: listing.id, productId: listing.productId, productName: listing.product.name, image: listing.product.images?.[0] ?? null }
    if (!listing.product.hasVariants)
      return [{ ...base, listingVariantId: null, variantDescription: null, sku: listing.product.sku, stock: listing.stock, listedThere: listed(listing.productId, null) }]
    return listing.storeListingVariants.map((row) => ({
      ...base,
      listingVariantId: row.id,
      variantDescription: describeVariant(row.variant.variantValues),
      sku: row.variant.sku,
      stock: row.stock,
      listedThere: listed(listing.productId, row.variantId),
    }))
  })
}
