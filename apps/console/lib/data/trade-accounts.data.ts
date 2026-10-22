import "server-only"

import { headers } from "next/headers"
import { consoleAuth } from "@workspace/auth/console"
import { formatError } from "@workspace/auth/format-error"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import type { DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus } from "@workspace/db/enums"
import { getPaginationError } from "@workspace/utils/pagination"
import { z } from "zod"

import { staffName } from "@/lib/order-details"
import type { TradeAccountDetails, TradeAccountsData, TradeAccountsParams } from "@/types"

export const MAX_TRADE_ACCOUNTS_PAGE_SIZE = 100
export const TRADE_ACCOUNT_SORT_FIELDS = ["createdAt", "companyName"] as const

const rowSelect = {
  id: true,
  companyName: true,
  businessType: true,
  status: true,
  discountPercent: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
  _count: { select: { orders: true } },
} satisfies Prisma.TradeAccountSelect

const toRow = ({ user, _count, discountPercent, ...account }: Prisma.TradeAccountGetPayload<{ select: typeof rowSelect }>) => ({
  ...account,
  discountPercent: discountPercent?.toString() ?? null,
  customer: user,
  orderCount: _count.orders,
})

async function canRead() {
  const session = await consoleAuth.api.getSession({ headers: await headers() })
  return !!session && hasSystemPermission(session.user.role, { tradeAccount: ["read"] })
}

// Storefront customers' trade accounts, newest first: applications to review and the accounts approved since
export const getTradeAccounts = async (filters: TradeAccountsParams = {}): Promise<DataResponse<TradeAccountsData>> => {
  try {
    if (!(await canRead())) return { success: false, error: "Unauthorized" }

    const paginationError = getPaginationError(filters, { maxPageSize: MAX_TRADE_ACCOUNTS_PAGE_SIZE, allowedSortFields: TRADE_ACCOUNT_SORT_FIELDS })
    if (paginationError) return { success: false, error: paginationError }

    const { search, status, businessType, page = 1, pageSize = 10, sort, order } = filters
    const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
    const where: Prisma.TradeAccountWhereInput = {
      ...(contains && { OR: [{ companyName: contains }, { registrationNumber: contains }, { tin: contains }, { user: { name: contains } }, { user: { email: contains } }] }),
      ...(status && { status }),
      ...(businessType && { businessType }),
    }
    // id breaks ties so rows with equal sort values keep their order across pages
    const orderBy = [sort ? { [sort]: order ?? (sort === "companyName" ? "asc" : "desc") } : { createdAt: "desc" as const }, { id: "asc" as const }]

    const [accounts, total] = await Promise.all([
      prisma.tradeAccount.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: rowSelect }),
      prisma.tradeAccount.count({ where }),
    ])
    return { success: true, data: { data: accounts.map(toRow), total, page, pageSize, totalPages: Math.ceil(total / pageSize) } }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export const getTradeAccount = async (accountId: string): Promise<DataResponse<TradeAccountDetails>> => {
  try {
    if (!(await canRead())) return { success: false, error: "Unauthorized" }
    // A uuid column: anything else would make Prisma throw instead of finding nothing
    if (!z.uuid().safeParse(accountId).success) return { success: false, error: "Trade account not found.", code: "NOT_FOUND" }

    const [account, totals, recentOrders] = await Promise.all([
      prisma.tradeAccount.findUnique({
        where: { id: accountId },
        select: { ...rowSelect, registrationNumber: true, tin: true, phone: true, details: true, rejectionReason: true, reviewedAt: true, reviewedBy: { select: { name: true } } },
      }),
      prisma.order.aggregate({ where: { tradeAccountId: accountId, status: { not: OrderStatus.CANCELLED } }, _sum: { totalGhs: true, discountAmountGhs: true } }),
      prisma.order.findMany({
        where: { tradeAccountId: accountId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, reference: true, status: true, paymentStatus: true, totalGhs: true, createdAt: true },
      }),
    ])
    if (!account) return { success: false, error: "Trade account not found.", code: "NOT_FOUND" }

    const { registrationNumber, tin, phone, details, rejectionReason, reviewedAt, reviewedBy, ...row } = account
    return {
      success: true,
      data: {
        ...toRow(row),
        registrationNumber,
        tin,
        phone,
        details,
        rejectionReason,
        reviewedAt,
        reviewedBy: staffName(reviewedBy),
        ordersTotalGhs: (totals._sum.totalGhs ?? new Prisma.Decimal(0)).toFixed(2),
        discountGivenGhs: (totals._sum.discountAmountGhs ?? new Prisma.Decimal(0)).toFixed(2),
        recentOrders: recentOrders.map((order) => ({ ...order, totalGhs: order.totalGhs.toFixed(2) })),
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
