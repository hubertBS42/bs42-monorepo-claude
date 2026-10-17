import "server-only"

import type { InvitationsData, InvitationsParams } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import type { DataResponse } from "@workspace/contracts"
import { getPaginationError } from "@workspace/utils/pagination"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { getStoreRole } from "@/lib/auth-guard"

export const MAX_INVITATIONS_PAGE_SIZE = 100
export const INVITATION_SORT_FIELDS = ["email", "role", "inviter", "createdAt", "expiresAt"] as const

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
}

// Pending invitations only, expired ones included: resending one renews it
export const getStoreInvitations = async (storeId: string, filters: InvitationsParams = {}): Promise<DataResponse<InvitationsData>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (!(await getStoreRole(session.user.id, storeId))) return { success: false, error: "Forbidden" }

    const paginationError = getPaginationError(filters, {
      maxPageSize: MAX_INVITATIONS_PAGE_SIZE,
      allowedSortFields: INVITATION_SORT_FIELDS,
    })
    if (paginationError) {
      return { success: false, error: paginationError }
    }

    const { email, role, page = 1, pageSize = 10, sort, order } = filters

    const where: Prisma.InvitationWhereInput = {
      organizationId: storeId,
      status: "pending",
      ...(email && { email: { contains: email, mode: "insensitive" as const } }),
      ...(role && { role }),
    }

    const direction = order === "desc" ? "desc" : "asc"
    const orderBy: Prisma.InvitationOrderByWithRelationInput = sort === "inviter" ? { inviter: { name: direction } } : sort ? { [sort]: direction } : { createdAt: "desc" }

    const [invitations, total] = await Promise.all([
      prisma.invitation.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { inviter: { select: { name: true, email: true } } },
      }),
      prisma.invitation.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: invitations,
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
