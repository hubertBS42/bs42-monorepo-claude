import "server-only"

import type { StoreMember, StoreMembersData, StoreMembersParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { consoleAuth } from "@workspace/auth/console"
import { consoleAdminRoles } from "@workspace/auth/system-permissions"
import { headers } from "next/headers"
import { getStoreRole } from "@/lib/auth-guard"

export const MAX_STORE_MEMBERS_PAGE_SIZE = 100
export const STORE_MEMBER_SORT_FIELDS = ["name", "email", "role", "createdAt"] as const

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
}

// Platform staff are added to every store automatically and are managed from /users, so store member
// lists leave them out. Role strings can be comma-separated, so match each role as a whole token.
const notPlatformStaff: Prisma.UserWhereInput = {
  NOT: {
    OR: consoleAdminRoles.flatMap((role) => [{ role }, { role: { startsWith: `${role},` } }, { role: { endsWith: `,${role}` } }, { role: { contains: `,${role},` } }]),
  },
}

export const getStoreMembers = async (storeId: string, filters: StoreMembersParams = {}): Promise<DataResponse<StoreMembersData>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (!(await getStoreRole(session.user.id, storeId))) return { success: false, error: "Forbidden" }

    const paginationError = getPaginationError(filters, {
      maxPageSize: MAX_STORE_MEMBERS_PAGE_SIZE,
      allowedSortFields: STORE_MEMBER_SORT_FIELDS,
    })
    if (paginationError) {
      return { success: false, error: paginationError }
    }

    const { name, email, role, page = 1, pageSize = 10, sort, order } = filters

    const where: Prisma.MemberWhereInput = {
      organizationId: storeId,
      ...(role && { role }),
      user: {
        AND: [notPlatformStaff, ...(name ? [{ name: { contains: name, mode: "insensitive" as const } }] : []), ...(email ? [{ email: { contains: email, mode: "insensitive" as const } }] : [])],
      },
    }

    const direction = order === "desc" ? "desc" : "asc"
    const orderBy: Prisma.MemberOrderByWithRelationInput = sort === "name" || sort === "email" ? { user: { [sort]: direction } } : sort ? { [sort]: direction } : { createdAt: "desc" }

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: true },
      }),
      prisma.member.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: members,
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

export async function getStoreMemberById(storeId: string, memberId: string): Promise<DataResponse<StoreMember>> {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (!(await getStoreRole(session.user.id, storeId))) return { success: false, error: "Forbidden" }

    // Sessions are deliberately not loaded: this goes to client components, and a session row holds its token
    const member = await prisma.member.findFirst({
      where: { id: memberId, organizationId: storeId, user: notPlatformStaff },
      include: { user: true },
    })

    if (!member) return { success: false, error: "Member not found", code: "NOT_FOUND" }

    return { success: true, data: member }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
