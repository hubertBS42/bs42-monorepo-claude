import "server-only"

import type { ProductsData, ProductsParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
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
    const { name, status, page = 1, pageSize = 10, sort, order } = filters

    const where = {
      ...(name && { name: { contains: name, mode: "insensitive" as const } }),
      ...(status && { status }),
    }

    // id breaks ties so rows with equal sort values keep their order across pages
    const orderBy = [sort ? { [sort]: order ?? "asc" } : { name: "asc" as const }, { id: "asc" as const }]

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          images: true,
          brand: {
            select: { name: true },
          },
          baseSellPrice: true,
          category: {
            select: { name: true },
          },
          condition: true,
          hasVariants: true,
          status: true,
          createdAt: true,
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ])

    return {
      success: true,
      data: {
        // Decimal can't be passed to client components, so the price goes as a string
        data: products.map((product) => ({ ...product, baseSellPrice: product.baseSellPrice.toString() })),
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
