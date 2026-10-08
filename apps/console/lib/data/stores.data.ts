import "server-only"

import type { Store, StoreForSelect, StoresData, StoresParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"

export const MAX_STORES_PAGE_SIZE = 100
export const STORE_SORT_FIELDS = ["name", "status", "createdAt", "updatedAt"] as const

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
}

export const getStores = async (filters: StoresParams = {}): Promise<DataResponse<StoresData>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    const paginationError = getPaginationError(filters, {
      maxPageSize: MAX_STORES_PAGE_SIZE,
      allowedSortFields: STORE_SORT_FIELDS,
    })
    if (paginationError) {
      return { success: false, error: paginationError }
    }

    const { name, page = 1, pageSize = 10, sort, order } = filters

    const isSystemAdmin = hasSystemRole(session.user.role, consoleAdminRoles)

    const where = {
      ...(isSystemAdmin ? { slug: { not: PLATFORM_ORGANIZATION_SLUG } } : { members: { some: { userId: session.user.id } } }),
      ...(name && { name: { contains: name, mode: "insensitive" as const } }),
    }

    const orderBy = sort ? { [sort]: order ?? "asc" } : { name: "asc" as const }

    const [stores, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.organization.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: stores,
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

export const getStoresForSelect = async (): Promise<DataResponse<StoreForSelect[]>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    const isSystemAdmin = hasSystemRole(session.user.role, consoleAdminRoles)
    const stores = await prisma.organization.findMany({
      where: {
        slug: { not: PLATFORM_ORGANIZATION_SLUG },
        ...(!isSystemAdmin && {
          members: { some: { userId: session.user.id } },
        }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })

    return {
      success: true,
      data: stores,
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export const getStoreById = async (storeId: string): Promise<DataResponse<Store>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    if (!storeId) return { success: false, error: "Missing or invalid store ID." }

    const isSystemAdmin = hasSystemRole(session.user.role, consoleAdminRoles)
    const store = await prisma.organization.findFirst({
      where: {
        id: storeId,
        slug: { not: PLATFORM_ORGANIZATION_SLUG },
        ...(!isSystemAdmin && {
          members: { some: { userId: session.user.id } },
        }),
      },
    })

    if (!store) return { success: false, error: "Store not found", code: "NOT_FOUND" }

    return { success: true, data: store }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
