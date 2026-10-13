import "server-only"

import type { UsersData, UsersParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { prisma } from "@workspace/db"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { consoleAuth } from "@workspace/auth/console"
import { hasSystemPermission, hasSystemRole } from "@workspace/auth/system-permissions"
import { headers } from "next/headers"

export const MAX_USERS_PAGE_SIZE = 100
export const USER_SORT_FIELDS = ["name", "email", "role", "createdAt", "updatedAt"] as const

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
}

export const getUsers = async (filters: UsersParams = {}): Promise<DataResponse<UsersData>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (!hasSystemPermission(session.user.role, { user: ["list"] })) return { success: false, error: "Forbidden" }

    const paginationError = getPaginationError(filters, {
      maxPageSize: MAX_USERS_PAGE_SIZE,
      allowedSortFields: USER_SORT_FIELDS,
    })
    if (paginationError) {
      return { success: false, error: paginationError }
    }

    const { name, email, page = 1, pageSize = 10, sort, order } = filters

    // Only superAdmins can see superAdmins. Role strings can be comma-separated, so match the token
    // anywhere in the string (no other role name contains "superAdmin").
    const isSuperAdmin = hasSystemRole(session.user.role, ["superAdmin"])

    const where = {
      ...(!isSuperAdmin && { NOT: { role: { contains: "superAdmin" } } }),
      ...(name && { name: { contains: name, mode: "insensitive" as const } }),
      ...(email && { email: { contains: email, mode: "insensitive" as const } }),
    }

    const orderBy = sort ? { [sort]: order ?? "asc" } : { createdAt: "desc" as const }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: users,
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
