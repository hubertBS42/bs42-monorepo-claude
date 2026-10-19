import "server-only"

import { headers } from "next/headers"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import type { DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { getPaginationError } from "@workspace/utils/pagination"
import { hasStorePermission } from "@/lib/auth-guard"
import type { SupplierDetails, SuppliersData, SuppliersParams } from "@/types"

export const MAX_SUPPLIERS_PAGE_SIZE = 100
export const SUPPLIER_SORT_FIELDS = ["name", "createdAt"] as const

// Everyone who can see the store's purchase orders can see who they're from
async function checkAccess(storeId: string): Promise<DataResponse<never> | undefined> {
  const session = await consoleAuth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: "Unauthorized" }
  if (!(await hasStorePermission(session.user.id, storeId, { purchaseOrder: ["read"] }))) return { success: false, error: "Forbidden" }
  return undefined
}

export const getSuppliers = async (storeId: string, filters: SuppliersParams = {}): Promise<DataResponse<SuppliersData>> => {
  try {
    const denied = await checkAccess(storeId)
    if (denied) return denied

    const paginationError = getPaginationError(filters, { maxPageSize: MAX_SUPPLIERS_PAGE_SIZE, allowedSortFields: SUPPLIER_SORT_FIELDS })
    if (paginationError) return { success: false, error: paginationError }

    const { name, archived, page = 1, pageSize = 10, sort, order } = filters
    const where: Prisma.SupplierWhereInput = {
      organizationId: storeId,
      ...(name && { name: { contains: name, mode: "insensitive" } }),
      ...(archived !== undefined && { isArchived: archived }),
    }
    const direction = order === "desc" ? "desc" : "asc"
    const orderBy: Prisma.SupplierOrderByWithRelationInput[] = [sort ? { [sort]: direction } : { name: "asc" }, { id: "asc" }]

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, contactName: true, email: true, phone: true, isArchived: true, _count: { select: { purchaseOrders: true } } },
      }),
      prisma.supplier.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: suppliers.map(({ _count, ...supplier }) => ({ ...supplier, purchaseOrderCount: _count.purchaseOrders })),
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

export const getSupplierById = async (storeId: string, id: string): Promise<DataResponse<SupplierDetails>> => {
  try {
    const denied = await checkAccess(storeId)
    if (denied) return denied

    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId: storeId },
      select: { id: true, name: true, contactName: true, email: true, phone: true, address: true, notes: true, isArchived: true, _count: { select: { purchaseOrders: true } } },
    })
    if (!supplier) return { success: false, error: "Supplier not found", code: "NOT_FOUND" }

    const { _count, ...rest } = supplier
    return { success: true, data: { ...rest, purchaseOrderCount: _count.purchaseOrders } }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
