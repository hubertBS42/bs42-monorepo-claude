import "server-only"

import type { ProductsData, ProductsParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import { Status } from "@workspace/db/enums"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { z } from "zod"

export const MAX_PRODUCTS_PAGE_SIZE = 100
export const PRODUCT_SORT_FIELDS = ["name", "baseSellPrice", "condition", "status", "createdAt", "updatedAt"] as const

const productIdSchema = z.uuid()

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
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
    const { search, status, page = 1, pageSize = 10, sort, order } = filters

    const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
    const where = {
      ...(contains && {
        OR: [{ name: contains }, { sku: contains }, { barcode: contains }, { variants: { some: { OR: [{ sku: contains }, { barcode: contains }] } } }],
      }),
      ...(status && { status }),
    }

    // id breaks ties so rows with equal sort values keep their order across pages
    const orderBy = [sort ? { [sort]: order ?? "asc" } : { name: "asc" as const }, { id: "asc" as const }]
    const notArchived = { where: { status: { not: Status.ARCHIVED } } }

    const [products, total, categories] = await Promise.all([
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
          condition: true,
          status: true,
          updatedAt: true,
          _count: { select: { variants: notArchived, storeListings: notArchived } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
      // The whole tree is small, and one read gives every row's path without a query per level
      prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
    ])

    const categoriesById = new Map(categories.map((category) => [category.id, category]))
    const getCategoryPath = (id: string) => {
      const names: string[] = []
      // The cycle trigger keeps the tree acyclic; the length cap only guards against a broken row
      for (let category = categoriesById.get(id); category && names.length < 20; category = category.parentId ? categoriesById.get(category.parentId) : undefined) {
        names.unshift(category.name)
      }
      return names.join(" / ")
    }

    return {
      success: true,
      data: {
        data: products.map(({ _count, categoryId, baseSellPrice, baseBuyPrice, ...product }) => ({
          ...product,
          baseSellPrice: baseSellPrice.toString(),
          baseBuyPrice: baseBuyPrice.toString(),
          categoryPath: getCategoryPath(categoryId),
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
