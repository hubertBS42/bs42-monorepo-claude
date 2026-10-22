import "server-only"

import { headers } from "next/headers"
import { consoleAuth } from "@workspace/auth/console"
import { formatError } from "@workspace/auth/format-error"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { quoteUrl } from "@workspace/commerce/order-links"
import type { DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { QuoteStatus } from "@workspace/db/enums"
import { dayStart } from "@workspace/utils/date"
import { getPaginationError } from "@workspace/utils/pagination"

import type { QuotesData, QuotesParams, QuoteStatusFilter } from "@/types"

export const MAX_QUOTES_PAGE_SIZE = 100
export const QUOTE_SORT_FIELDS = ["createdAt", "totalGhs", "validUntil"] as const

// What each status filter matches: open and expired are both OPEN, either side of validUntil
function statusWhere(status: QuoteStatusFilter, now: Date): Prisma.QuoteWhereInput {
  switch (status) {
    case "open":
      return { status: QuoteStatus.OPEN, validUntil: { gt: now } }
    case "expired":
      return { status: QuoteStatus.OPEN, validUntil: { lte: now } }
    case "accepted":
      return { status: QuoteStatus.ACCEPTED }
    case "cancelled":
      return { status: QuoteStatus.CANCELLED }
  }
}

// Every customer's quotations, newest first, for staff following them up. Read-only: customers make, accept and
// cancel them on the storefront.
export const getQuotes = async (filters: QuotesParams = {}): Promise<DataResponse<QuotesData>> => {
  try {
    const session = await consoleAuth.api.getSession({ headers: await headers() })
    if (!session || !hasSystemPermission(session.user.role, { order: ["read"] })) return { success: false, error: "Unauthorized" }

    const paginationError = getPaginationError(filters, { maxPageSize: MAX_QUOTES_PAGE_SIZE, allowedSortFields: QUOTE_SORT_FIELDS })
    if (paginationError) return { success: false, error: paginationError }

    const { search, status, trade, madeStart, madeEnd, page = 1, pageSize = 10, sort, order } = filters
    const now = new Date()
    const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
    const where: Prisma.QuoteWhereInput = {
      ...(contains && { OR: [{ reference: contains }, { customerName: contains }, { customerEmail: contains }, { tradeCompanyName: contains }] }),
      ...(status && statusWhere(status, now)),
      ...(trade && { tradeCompanyName: trade === "true" ? { not: null } : null }),
      ...((madeStart || madeEnd) && {
        createdAt: {
          ...(madeStart && { gte: dayStart(madeStart) }),
          // The end day is included, so up to the start of the next one
          ...(madeEnd && { lt: dayStart(madeEnd, 1) }),
        },
      }),
    }
    // id breaks ties so rows with equal sort values keep their order across pages
    const orderBy = [sort ? { [sort]: order ?? "desc" } : { createdAt: "desc" as const }, { id: "asc" as const }]

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          reference: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          tradeCompanyName: true,
          totalGhs: true,
          status: true,
          validUntil: true,
          createdAt: true,
          order: { select: { id: true, reference: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.quote.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: quotes.map((quote) => ({
          id: quote.id,
          reference: quote.reference,
          url: quoteUrl(quote.reference, quote.id),
          customer: { name: quote.customerName, email: quote.customerEmail, phone: quote.customerPhone },
          tradeCompanyName: quote.tradeCompanyName,
          lineCount: quote._count.items,
          totalGhs: quote.totalGhs.toFixed(2),
          status: quote.status === QuoteStatus.OPEN ? (quote.validUntil > now ? "open" : "expired") : quote.status === QuoteStatus.ACCEPTED ? "accepted" : "cancelled",
          // validUntil is the start of the day after the last one its prices hold
          validUntil: new Date(quote.validUntil.getTime() - 1),
          order: quote.order,
          createdAt: quote.createdAt,
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
