import "server-only"

import type { BrandsData, BrandsParams, SelectItem } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import type { Brand, Prisma } from "@workspace/db/client"
import { Status } from "@workspace/db/enums"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { z } from "zod"

export const MAX_BRANDS_PAGE_SIZE = 100
export const BRAND_SORT_FIELDS = ["name", "status", "createdAt", "updatedAt"] as const

const brandIdSchema = z.uuid()

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
}

export const getBrands = async (filters: BrandsParams = {}): Promise<DataResponse<BrandsData>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    const paginationError = getPaginationError(filters, {
      maxPageSize: MAX_BRANDS_PAGE_SIZE,
      allowedSortFields: BRAND_SORT_FIELDS,
    })
    if (paginationError) {
      return { success: false, error: paginationError }
    }

    const { name, status, page = 1, pageSize = 10, sort, order } = filters

    const where: Prisma.BrandWhereInput = {
      ...(name && { name: { contains: name, mode: "insensitive" as const } }),
      ...(status && { status }),
    }

    // id breaks ties so rows with equal sort values keep their order across pages
    const orderBy = [sort ? { [sort]: order ?? "asc" } : { name: "asc" as const }, { id: "asc" as const }]

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.brand.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: brands,
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

export const getBrandsForSelect = async (): Promise<DataResponse<SelectItem[]>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    // Archived brands can't be assigned to anything new
    const brands = await prisma.brand.findMany({
      where: { status: { not: Status.ARCHIVED } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })

    return {
      success: true,
      data: brands,
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export const getBrandById = async (brandId: string): Promise<DataResponse<Brand>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    // Brand.id is a UUID column, so any other value would make Postgres throw instead of finding nothing
    if (!brandIdSchema.safeParse(brandId).success) return { success: false, error: "Brand not found.", code: "NOT_FOUND" }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand) return { success: false, error: "Brand not found.", code: "NOT_FOUND" }

    return { success: true, data: brand }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
