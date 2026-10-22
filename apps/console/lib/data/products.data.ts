import "server-only"

import type { ProductFormData, ProductsData, ProductsParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import { Status } from "@workspace/db/enums"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { z } from "zod"
import { toSpecFormValue } from "@/lib/product-specs"

export const MAX_PRODUCTS_PAGE_SIZE = 100
export const PRODUCT_SORT_FIELDS = ["name", "baseSellPrice", "status", "createdAt", "updatedAt"] as const

const productIdSchema = z.uuid()

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
}

type CategoryRow = { id: string; name: string; parentId: string | null }

// "Men / Accessories" for each category: names only have to be unique among siblings, so the path tells them apart
export function getCategoryPaths(categories: CategoryRow[]) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const paths = new Map<string, string>()
  for (const { id } of categories) {
    const names: string[] = []
    // The cycle trigger keeps the tree acyclic; the length cap only guards against a broken row
    for (let category = byId.get(id); category && names.length < 20; category = category.parentId ? byId.get(category.parentId) : undefined) {
      names.unshift(category.name)
    }
    paths.set(id, names.join(" / "))
  }
  return paths
}

// A category and everything under it, so filtering on "Men" includes "Men / Shoes"
export function getSubtreeIds(categories: CategoryRow[], rootId: string) {
  const ids = [rootId]
  for (let index = 0; index < ids.length; index++) {
    for (const category of categories) if (category.parentId === ids[index]) ids.push(category.id)
  }
  return ids
}

export const getProductsForTable = async (filters: ProductsParams = {}): Promise<DataResponse<ProductsData>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    const paginationError = getPaginationError(filters, {
      maxPageSize: MAX_PRODUCTS_PAGE_SIZE,
      allowedSortFields: PRODUCT_SORT_FIELDS,
    })
    if (paginationError) {
      return { success: false, error: paginationError }
    }
    const { search, status, brandId, categoryId, condition, hasVariants, page = 1, pageSize = 10, sort, order } = filters

    // The whole tree is small: one read gives every row's path and the category filter's subtree
    const categories = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } })

    const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
    const where = {
      ...(contains && {
        OR: [{ name: contains }, { sku: contains }, { barcode: contains }, { variants: { some: { OR: [{ sku: contains }, { barcode: contains }] } } }],
      }),
      ...(status && { status }),
      ...(brandId && { brandId }),
      ...(categoryId && { categoryId: { in: getSubtreeIds(categories, categoryId) } }),
      ...(condition && { condition }),
      ...(hasVariants !== undefined && { hasVariants }),
    }

    // id breaks ties so rows with equal sort values keep their order across pages
    const orderBy = [sort ? { [sort]: order ?? "asc" } : { name: "asc" as const }, { id: "asc" as const }]
    const notArchived = { where: { status: { not: Status.ARCHIVED } } }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          images: true,
          brand: { select: { id: true, name: true } },
          baseSellPrice: true,
          baseBuyPrice: true,
          categoryId: true,
          status: true,
          updatedAt: true,
          _count: { select: { variants: notArchived, storeListings: notArchived } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ])

    const categoryPaths = getCategoryPaths(categories)

    return {
      success: true,
      data: {
        data: products.map(({ _count, categoryId, baseSellPrice, baseBuyPrice, ...product }) => ({
          ...product,
          baseSellPrice: baseSellPrice.toString(),
          baseBuyPrice: baseBuyPrice.toString(),
          categoryPath: categoryPaths.get(categoryId) ?? "",
          variantCount: _count.variants,
          storeCount: _count.storeListings,
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

export interface ProductFilterOptions {
  brands: { label: string; value: string }[]
  categories: { label: string; value: string }[]
}

// Archived brands and categories still have products, so they're offered too, marked as archived
export const getProductFilterOptions = async (): Promise<DataResponse<ProductFilterOptions>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    const [brands, categories] = await Promise.all([
      prisma.brand.findMany({ select: { id: true, name: true, status: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
      prisma.category.findMany({ select: { id: true, name: true, parentId: true, status: true } }),
    ])

    const archived = (name: string, status: Status) => (status === Status.ARCHIVED ? `${name} (archived)` : name)
    const paths = getCategoryPaths(categories)

    return {
      success: true,
      data: {
        brands: brands.map((brand) => ({ label: archived(brand.name, brand.status), value: brand.id })),
        categories: categories.map((category) => ({ label: archived(paths.get(category.id) ?? category.name, category.status), value: category.id })).sort((a, b) => a.label.localeCompare(b.label)),
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

const PRODUCT_NOT_FOUND = { success: false as const, error: "Product not found.", code: "NOT_FOUND" }

export const getProductForEdit = async (productId: string): Promise<DataResponse<ProductFormData>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    // Product.id is a UUID column, so any other value would make Postgres throw instead of finding nothing
    if (!productIdSchema.safeParse(productId).success) return PRODUCT_NOT_FOUND

    const [product, order, purchased] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        include: {
          brand: { select: { id: true, name: true, status: true } },
          documents: { select: { id: true, name: true, url: true }, orderBy: { createdAt: "asc" } },
          variantOptions: {
            select: { id: true, name: true, position: true, values: { select: { id: true, value: true, position: true }, orderBy: { position: "asc" } } },
            orderBy: { position: "asc" },
          },
          // Archived variants stay for past orders but aren't edited any more
          variants: {
            where: { status: { not: Status.ARCHIVED } },
            select: {
              id: true,
              sku: true,
              barcode: true,
              images: true,
              weight: true,
              dimensions: true,
              position: true,
              variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true } } } } } },
              _count: { select: { orderItems: true, storeListingVariants: true } },
              storeListingVariants: { select: { _count: { select: { orderItems: true, purchaseOrderItems: true } } } },
            },
            orderBy: { position: "asc" },
          },
          _count: { select: { storeListings: true } },
          specValues: { select: { specId: true, optionId: true, numberValue: true, booleanValue: true, textValue: true } },
        },
      }),
      // An order line can point at the product, one of its variants or a store's listing of it
      prisma.orderItem.findFirst({ where: { OR: [{ productId }, { productVariant: { productId } }, { storeListing: { productId } }] }, select: { id: true } }),
      // A purchase order line restricts deleting the product just the same
      prisma.purchaseOrderItem.findFirst({ where: { storeListing: { productId } }, select: { id: true } }),
    ])

    if (!product) return PRODUCT_NOT_FOUND

    const documents = product.documents.map(({ id, name, url }) => ({ id, name, url }))
    const variants = product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      barcode: variant.barcode ?? "",
      images: variant.images,
      weight: variant.weight?.toNumber() ?? null,
      dimensions: variant.dimensions ?? "",
      position: variant.position,
      attributes: Object.fromEntries(variant.variantValues.map(({ optionValue }) => [optionValue.option.name, optionValue.value])),
    }))

    return {
      success: true,
      data: {
        id: product.id,
        name: product.name,
        brand: { id: product.brand.id, name: product.brand.name, isArchived: product.brand.status === Status.ARCHIVED },
        values: {
          name: product.name,
          description: product.description,
          tags: product.tags,
          documents,
          categoryId: product.categoryId,
          brandId: product.brandId,
          baseSellPrice: product.baseSellPrice.toNumber(),
          baseBuyPrice: product.baseBuyPrice.toNumber(),
          sku: product.sku ?? "",
          barcode: product.barcode ?? "",
          dimensions: product.dimensions ?? "",
          weight: product.weight?.toNumber() ?? null,
          hasVariants: product.hasVariants,
          status: product.status,
          condition: product.condition,
          installation: product.installation,
          installationFeeGhs: product.installationFeeGhs?.toNumber() ?? null,
          images: product.images,
          banner: product.banner ?? "",
          variantOptions: product.variantOptions,
          variants,
          specs: Object.fromEntries(product.specValues.map((value) => [value.specId, toSpecFormValue(value)])),
        },
        savedFiles: [...product.images, ...(product.banner ? [product.banner] : []), ...documents.map((document) => document.url), ...variants.flatMap((variant) => variant.images)],
        variantUsage: Object.fromEntries(
          product.variants.map((variant) => [
            variant.id,
            {
              // Bought in on a purchase order counts too: its lines restrict deleting the variant the same way
              ordered: variant._count.orderItems > 0 || variant.storeListingVariants.some((listing) => listing._count.orderItems > 0 || listing._count.purchaseOrderItems > 0),
              storeCount: variant._count.storeListingVariants,
            },
          ])
        ),
        storeCount: product._count.storeListings,
        hasOrders: !!order || !!purchased,
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
