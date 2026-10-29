import "server-only"

import type { UsersData, UsersParams, UserDetails } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { consoleAuth } from "@workspace/auth/console"
import { hasSystemPermission, hasSystemRole } from "@workspace/auth/system-permissions"
import { headers } from "next/headers"
import { toPhoneSearch } from "@workspace/utils/phone"

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

    const { search, role, status, page = 1, pageSize = 10, sort, order } = filters

    // Only superAdmins can see superAdmins. Role strings can be comma-separated, so match the token
    // anywhere in the string (no other role name contains "superAdmin").
    const isSuperAdmin = hasSystemRole(session.user.role, ["superAdmin"])

    const now = new Date()
    const contains = (value: string) => ({ contains: value, mode: "insensitive" as const })
    // Phones are stored in international form, so a local "0244…" is searched as "+233244…" too
    const phoneSearch = search ? toPhoneSearch(search) : null
    const conditions: Prisma.UserWhereInput[] = [
      ...(!isSuperAdmin ? [{ NOT: { role: { contains: "superAdmin" } } }] : []),
      ...(search ? [{ OR: [{ name: contains(search) }, { email: contains(search) }, { phone: contains(search) }, ...(phoneSearch ? [{ phone: contains(phoneSearch) }] : [])] }] : []),
      // Match the role as a whole token in the comma-separated string, not as a substring
      ...(role ? [{ OR: [{ role }, { role: { startsWith: `${role},` } }, { role: { endsWith: `,${role}` } }, { role: { contains: `,${role},` } }] }] : []),
      // Same rule as isBanActive: a ban only counts until it expires. Active is spelled out rather than written as
      // NOT(banned), because banned is nullable and NOT around a null comparison would drop those users.
      ...(status === "banned" ? [{ banned: true, OR: [{ banExpires: null }, { banExpires: { gt: now } }] }] : []),
      ...(status === "active" ? [{ OR: [{ banned: null }, { banned: false }, { banExpires: { lte: now } }] }] : []),
    ]
    const where: Prisma.UserWhereInput = { AND: conditions }

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

export async function getUserById(userId: string): Promise<DataResponse<UserDetails>> {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (!hasSystemPermission(session.user.role, { user: ["get"] })) return { success: false, error: "Forbidden" }

    // Same rule as getUsers: superAdmins are invisible to everyone else, so they get a 404
    const isSuperAdmin = hasSystemRole(session.user.role, ["superAdmin"])

    // Sessions are deliberately not loaded: this goes to client components, and a session row holds its token
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        ...(!isSuperAdmin && { NOT: { role: { contains: "superAdmin" } } }),
      },
      include: {
        addresses: { orderBy: { createdAt: "desc" } },
        members: {
          include: { organization: true },
        },
      },
    })

    if (!user) return { success: false, error: "User not found", code: "NOT_FOUND" }

    return { success: true, data: user }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
