import "server-only"

import { headers } from "next/headers"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import type { DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { getPaginationError } from "@workspace/utils/pagination"
import { getStoreRole } from "@/lib/auth-guard"
import type { StockHistoryData, StockHistoryParams } from "@/types"

export const MAX_STOCK_HISTORY_PAGE_SIZE = 100

// "Size: M / Colour: Red", in the product's option order
const variantValuesSelect = { variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } } } satisfies Prisma.ProductVariantSelect
type VariantValues = Prisma.ProductVariantGetPayload<{ select: typeof variantValuesSelect }>
const describe = ({ variantValues }: VariantValues) =>
  [...variantValues]
    .sort((a, b) => a.optionValue.option.position - b.optionValue.option.position)
    .map(({ optionValue }) => `${optionValue.option.name}: ${optionValue.value}`)
    .join(" / ")

// A listing's stock movements, newest first. Any member of the store can see them, as they can its listings.
export const getStockHistory = async (storeId: string, listingId: string, filters: StockHistoryParams = {}): Promise<DataResponse<StockHistoryData>> => {
  try {
    const session = await consoleAuth.api.getSession({ headers: await headers() })
    if (!session) return { success: false, error: "Unauthorized" }
    if (!(await getStoreRole(session.user.id, storeId))) return { success: false, error: "Forbidden" }

    const paginationError = getPaginationError(filters, { maxPageSize: MAX_STOCK_HISTORY_PAGE_SIZE, allowedSortFields: [] })
    if (paginationError) return { success: false, error: paginationError }

    const listing = await prisma.storeListing.findFirst({
      where: { id: listingId, organizationId: storeId },
      select: {
        id: true,
        product: { select: { name: true, hasVariants: true } },
        storeListingVariants: { orderBy: { variant: { position: "asc" } }, select: { id: true, variant: { select: variantValuesSelect } } },
      },
    })
    if (!listing) return { success: false, error: "Listing not found", code: "NOT_FOUND" }

    const { reason, variantId, page = 1, pageSize = 20 } = filters
    const where: Prisma.StockMovementWhereInput = {
      storeListingId: listingId,
      ...(reason && { reason }),
      ...(variantId && { storeListingVariantId: variantId }),
    }
    // A variant filter from the URL that isn't one of this listing's variants (and isn't a uuid Prisma would accept)
    const isKnownVariant = !variantId || listing.storeListingVariants.some((row) => row.id === variantId)

    const [movements, total] = await Promise.all([
      !isKnownVariant
        ? []
        : prisma.stockMovement.findMany({
            where,
            // id breaks ties so movements made in one transaction keep their order across pages
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: {
              id: true,
              createdAt: true,
              change: true,
              stockAfter: true,
              reason: true,
              note: true,
              createdBy: { select: { name: true, email: true } },
              storeListingVariant: { select: { variant: { select: variantValuesSelect } } },
              order: { select: { id: true, reference: true } },
              purchaseOrderReceipt: { select: { purchaseOrder: { select: { id: true, reference: true } } } },
            },
          }),
      isKnownVariant ? prisma.stockMovement.count({ where }) : 0,
    ])

    return {
      success: true,
      data: {
        listing: {
          id: listing.id,
          productName: listing.product.name,
          hasVariants: listing.product.hasVariants,
          variants: listing.storeListingVariants.map((row) => ({ id: row.id, name: describe(row.variant) })),
        },
        movements: {
          data: movements.map(({ createdBy, storeListingVariant, order, purchaseOrderReceipt, ...movement }) => {
            const purchaseOrder = purchaseOrderReceipt?.purchaseOrder
            return {
              ...movement,
              variantDescription: storeListingVariant ? describe(storeListingVariant.variant) : null,
              createdBy: createdBy ? createdBy.name || createdBy.email : null,
              source: order
                ? { label: order.reference, href: `/store/orders/${order.id}/details` }
                : purchaseOrder
                  ? { label: purchaseOrder.reference, href: `/store/purchase-orders/${purchaseOrder.id}/details` }
                  : null,
            }
          }),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
