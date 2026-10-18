import "server-only"

import type { ListableProduct, ListingFormData, ListingsData, ListingsParams, ListingStockState, ListingVariantRow } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { Status } from "@workspace/db/enums"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { z } from "zod"
import { getStoreRole } from "@/lib/auth-guard"
import { getCategoryPaths, getSubtreeIds } from "@/lib/data/products.data"
import { stockStatesSql } from "@/lib/stock-states"

export const MAX_LISTINGS_PAGE_SIZE = 100
export const LISTING_SORT_FIELDS = ["name", "sellPrice", "status", "createdAt", "updatedAt"] as const

// The add page shows this many products at a time, and "Show more" adds as many again up to the most
export const LISTABLE_PRODUCTS_STEP = 48
export const MAX_LISTABLE_PRODUCTS = 480

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
}

// Only members of the store can see its listings
async function checkStoreAccess(storeId: string): Promise<DataResponse<never> | undefined> {
  const session = await getSession()
  if (!session) return { success: false, error: "Unauthorized" }
  if (!(await getStoreRole(session.user.id, storeId))) return { success: false, error: "Forbidden" }
  return undefined
}

async function getCategoryPathMap() {
  return getCategoryPaths(await prisma.category.findMany({ select: { id: true, name: true, parentId: true } }))
}

// A store sells the product's variants that aren't archived: archived ones stay only for orders that have them
const sellableVariants = {
  where: { status: { not: Status.ARCHIVED } },
  orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
  select: {
    id: true,
    sku: true,
    variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } },
  },
}

// Customers can buy it: published, its product published, and, for a product with variants, at least one variant on sale.
// The same rule as the table's "not on sale" note.
const visibleToCustomers: Prisma.StoreListingWhereInput = {
  status: Status.PUBLISHED,
  product: { status: Status.PUBLISHED },
  OR: [{ product: { hasVariants: false } }, { storeListingVariants: { some: { status: Status.PUBLISHED, variant: { status: { not: Status.ARCHIVED } } } } }],
}

// The store's listings in a stock state, as the stock column's badges show it
async function getListingIdsInStockState(storeId: string, state: ListingStockState) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`${stockStatesSql(storeId)} SELECT "id" FROM states WHERE "state" = ${state}`
  return rows.map((row) => row.id)
}

type SellableVariant = Prisma.ProductVariantGetPayload<{ select: typeof sellableVariants.select }>

function toVariantRow(variant: SellableVariant, inListing: boolean): ListingVariantRow {
  const values = [...variant.variantValues].sort((a, b) => a.optionValue.option.position - b.optionValue.option.position)
  return {
    variantId: variant.id,
    sku: variant.sku,
    attributes: Object.fromEntries(values.map(({ optionValue }) => [optionValue.option.name, optionValue.value])),
    inListing,
  }
}

export const getStoreListings = async (storeId: string, filters: ListingsParams = {}): Promise<DataResponse<ListingsData>> => {
  try {
    const denied = await checkStoreAccess(storeId)
    if (denied) return denied

    const paginationError = getPaginationError(filters, {
      maxPageSize: MAX_LISTINGS_PAGE_SIZE,
      allowedSortFields: LISTING_SORT_FIELDS,
    })
    if (paginationError) {
      return { success: false, error: paginationError }
    }

    const { search, status, stock, brandId, categoryId, visible, page = 1, pageSize = 10, sort, order } = filters

    // Brand and category ids are uuid columns, so a malformed one (a hand-edited URL) would make Prisma throw: it matches nothing
    const isUuid = (value: string | undefined) => !value || z.uuid().safeParse(value).success
    if (!isUuid(brandId) || !isUuid(categoryId)) return { success: true, data: { data: [], total: 0, page, pageSize, totalPages: 0 } }

    // The whole tree is small: one read gives every row's path and the category filter's subtree
    const categories = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } })
    const stockIds = stock ? await getListingIdsInStockState(storeId, stock) : null

    const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
    // AND, so filters on the same relation (product) don't overwrite each other
    const where: Prisma.StoreListingWhereInput = {
      organizationId: storeId,
      AND: [
        ...(contains ? [{ product: { OR: [{ name: contains }, { sku: contains }, { variants: { some: { sku: contains } } }] } }] : []),
        ...(status ? [{ status }] : []),
        ...(stockIds ? [{ id: { in: stockIds } }] : []),
        ...(brandId ? [{ product: { brandId } }] : []),
        ...(categoryId ? [{ product: { categoryId: { in: getSubtreeIds(categories, categoryId) } } }] : []),
        ...(visible ? [visible === "true" ? visibleToCustomers : { NOT: visibleToCustomers }] : []),
      ],
    }

    const direction = order === "desc" ? "desc" : "asc"
    // id breaks ties so rows with equal sort values keep their order across pages
    const orderBy: Prisma.StoreListingOrderByWithRelationInput[] = [sort === "name" ? { product: { name: direction } } : sort ? { [sort]: direction } : { updatedAt: "desc" }, { id: "asc" }]

    const categoryPaths = getCategoryPaths(categories)
    const [listings, total] = await Promise.all([
      prisma.storeListing.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          sellPrice: true,
          stock: true,
          trackInventory: true,
          lowStockThreshold: true,
          isFeatured: true,
          status: true,
          updatedAt: true,
          product: { select: { id: true, name: true, images: true, status: true, hasVariants: true, categoryId: true, brand: { select: { id: true, name: true } } } },
          // The variants on sale: published in the store, and not archived in the catalogue
          storeListingVariants: {
            where: { status: Status.PUBLISHED, variant: { status: { not: Status.ARCHIVED } } },
            select: { sellPrice: true, stock: true },
          },
        },
      }),
      prisma.storeListing.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: listings.map((listing) => {
          const { product } = listing
          const variants = product.hasVariants ? listing.storeListingVariants : []
          const stock = product.hasVariants ? variants.reduce((sum, variant) => sum + variant.stock, 0) : listing.stock

          // The alert applies to each variant, so one sold-out size counts even when the others have plenty
          const stocks = product.hasVariants ? variants.map((variant) => variant.stock) : [listing.stock]
          const outCount = stocks.filter((value) => value === 0).length
          const lowCount = stocks.filter((value) => value > 0 && value <= listing.lowStockThreshold).length
          const stockAlert = !listing.trackInventory ? null : outCount ? { kind: "out" as const, count: outCount } : lowCount ? { kind: "low" as const, count: lowCount } : null

          const notOnSaleReason =
            listing.status !== Status.PUBLISHED
              ? null
              : product.status !== Status.PUBLISHED
                ? `The catalogue product is ${product.status.toLowerCase()}.`
                : product.hasVariants && variants.length === 0
                  ? "No variant is published."
                  : null

          // A variant without its own price sells at the listing's
          const prices = variants.map((variant) => variant.sellPrice ?? listing.sellPrice)
          const min = prices.length ? Prisma.Decimal.min(...prices) : null
          const max = prices.length ? Prisma.Decimal.max(...prices) : null
          const priceRange = min && max && !(min.equals(max) && min.equals(listing.sellPrice)) ? { min: min.toString(), max: max.toString() } : null

          return {
            id: listing.id,
            product: {
              id: product.id,
              name: product.name,
              image: product.images[0] ?? null,
              brandId: product.brand.id,
              brandName: product.brand.name,
              categoryPath: categoryPaths.get(product.categoryId) ?? "",
              hasVariants: product.hasVariants,
            },
            sellPrice: listing.sellPrice.toString(),
            priceRange,
            stock,
            trackInventory: listing.trackInventory,
            stockAlert,
            isFeatured: listing.isFeatured,
            status: listing.status,
            notOnSaleReason,
            updatedAt: listing.updatedAt,
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

// Published catalogue products the store hasn't listed yet, the first `limit` of them by name
export const getListableProducts = async (storeId: string, search?: string, limit = LISTABLE_PRODUCTS_STEP): Promise<DataResponse<{ products: ListableProduct[]; total: number }>> => {
  try {
    const denied = await checkStoreAccess(storeId)
    if (denied) return denied

    const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
    const where: Prisma.ProductWhereInput = {
      status: Status.PUBLISHED,
      storeListings: { none: { organizationId: storeId } },
      ...(contains && { OR: [{ name: contains }, { sku: contains }, { brand: { name: contains } }] }),
    }

    const [products, total, categoryPaths] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: Math.min(limit, MAX_LISTABLE_PRODUCTS),
        select: { id: true, name: true, images: true, baseSellPrice: true, hasVariants: true, categoryId: true, brand: { select: { name: true } } },
      }),
      prisma.product.count({ where }),
      getCategoryPathMap(),
    ])

    return {
      success: true,
      data: {
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          image: product.images[0] ?? null,
          brandName: product.brand.name,
          categoryPath: categoryPaths.get(product.categoryId) ?? "",
          baseSellPrice: product.baseSellPrice.toString(),
          hasVariants: product.hasVariants,
        })),
        total,
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

const listingProductSelect = {
  id: true,
  name: true,
  images: true,
  status: true,
  hasVariants: true,
  categoryId: true,
  baseSellPrice: true,
  baseBuyPrice: true,
  brand: { select: { name: true } },
  variants: sellableVariants,
} satisfies Prisma.ProductSelect

type ListingProduct = Prisma.ProductGetPayload<{ select: typeof listingProductSelect }>

async function toFormProduct(product: ListingProduct): Promise<ListingFormData["product"]> {
  const categoryPaths = await getCategoryPathMap()
  return {
    id: product.id,
    name: product.name,
    image: product.images[0] ?? null,
    brandName: product.brand.name,
    categoryPath: categoryPaths.get(product.categoryId) ?? "",
    status: product.status,
    hasVariants: product.hasVariants,
  }
}

// The store's listing of a product, for sending the user to it when they try to list the product again
export const getListingIdForProduct = async (storeId: string, productId: string): Promise<string | null> => {
  if (await checkStoreAccess(storeId)) return null
  const listing = await prisma.storeListing.findUnique({ where: { organizationId_productId: { organizationId: storeId, productId } }, select: { id: true } })
  return listing?.id ?? null
}

// The add form for one product. ALREADY_LISTED when the store lists it: getListingIdForProduct finds that listing.
export const getNewListingFormData = async (storeId: string, productId: string): Promise<DataResponse<ListingFormData>> => {
  try {
    const denied = await checkStoreAccess(storeId)
    if (denied) return denied

    const [product, existing] = await Promise.all([
      prisma.product.findFirst({ where: { id: productId, status: Status.PUBLISHED }, select: listingProductSelect }),
      prisma.storeListing.findUnique({ where: { organizationId_productId: { organizationId: storeId, productId } }, select: { id: true } }),
    ])
    if (!product) return { success: false, error: "Product not found", code: "NOT_FOUND" }
    if (existing) return { success: false, error: "This store already lists this product.", code: "ALREADY_LISTED" }

    const variants = product.hasVariants ? product.variants.map((variant) => toVariantRow(variant, false)) : []

    return {
      success: true,
      data: {
        product: await toFormProduct(product),
        variants,
        values: {
          // The catalogue's prices are the starting point
          sellPrice: product.baseSellPrice.toNumber(),
          buyPrice: product.baseBuyPrice.isZero() ? null : product.baseBuyPrice.toNumber(),
          compareAtPrice: null,
          stock: 0,
          lowStockThreshold: 5,
          trackInventory: true,
          isFeatured: false,
          status: Status.DRAFT,
          // The listing's status decides what customers see, so variants start published at the listing's price
          variants: variants.map(({ variantId }) => ({ variantId, sellPrice: null, stock: 0, status: Status.PUBLISHED })),
        },
        hasOrders: false,
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export const getListingFormData = async (storeId: string, listingId: string): Promise<DataResponse<ListingFormData>> => {
  try {
    const denied = await checkStoreAccess(storeId)
    if (denied) return denied

    const [listing, ordered] = await Promise.all([
      prisma.storeListing.findFirst({
        where: { id: listingId, organizationId: storeId },
        select: {
          id: true,
          sellPrice: true,
          buyPrice: true,
          compareAtPrice: true,
          stock: true,
          lowStockThreshold: true,
          trackInventory: true,
          isFeatured: true,
          status: true,
          product: { select: listingProductSelect },
          storeListingVariants: { select: { variantId: true, sellPrice: true, stock: true, status: true } },
        },
      }),
      prisma.orderItem.findFirst({ where: { storeListingId: listingId }, select: { id: true } }),
    ])
    if (!listing) return { success: false, error: "Listing not found", code: "NOT_FOUND" }

    const { product } = listing
    const saved = new Map(listing.storeListingVariants.map((variant) => [variant.variantId, variant]))
    const variants = product.hasVariants ? product.variants.map((variant) => toVariantRow(variant, saved.has(variant.id))) : []

    return {
      success: true,
      data: {
        id: listing.id,
        product: await toFormProduct(product),
        variants,
        values: {
          sellPrice: listing.sellPrice.toNumber(),
          buyPrice: listing.buyPrice?.toNumber() ?? null,
          compareAtPrice: listing.compareAtPrice?.toNumber() ?? null,
          stock: listing.stock,
          lowStockThreshold: listing.lowStockThreshold,
          trackInventory: listing.trackInventory,
          isFeatured: listing.isFeatured,
          status: listing.status,
          // A variant added to the product since the listing was made starts like a new listing's
          variants: variants.map(({ variantId }) => {
            const variant = saved.get(variantId)
            return variant
              ? { variantId, sellPrice: variant.sellPrice?.toNumber() ?? null, stock: variant.stock, status: variant.status }
              : { variantId, sellPrice: null, stock: 0, status: Status.PUBLISHED }
          }),
        },
        hasOrders: !!ordered,
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
