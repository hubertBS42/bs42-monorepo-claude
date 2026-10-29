import "server-only"

import { headers } from "next/headers"
import { consoleAuth } from "@workspace/auth/console"
import { formatError } from "@workspace/auth/format-error"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { quoteUrl } from "@workspace/commerce/order-links"
import { catalogueProductHref } from "@/lib/product-links"
import { loadTradeTerms } from "@workspace/commerce/trade-accounts"
import type { DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { QuoteStatus } from "@workspace/db/enums"
import { dayStart } from "@workspace/utils/date"
import { getPaginationError } from "@workspace/utils/pagination"

import type { QuoteCopy, QuoteDetails, QuotesData, QuotesParams, QuoteStatusFilter } from "@/types"

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

// Every quotation, newest first: those customers made from their basket and those staff made for them
export const getQuotes = async (filters: QuotesParams = {}): Promise<DataResponse<QuotesData>> => {
  try {
    const session = await consoleAuth.api.getSession({ headers: await headers() })
    if (!session || !hasSystemPermission(session.user.role, { order: ["read"] })) return { success: false, error: "Unauthorized" }

    const paginationError = getPaginationError(filters, { maxPageSize: MAX_QUOTES_PAGE_SIZE, allowedSortFields: QUOTE_SORT_FIELDS })
    if (paginationError) return { success: false, error: paginationError }

    const { search, status, trade, madeStart, madeEnd, madeBy, page = 1, pageSize = 10, sort, order } = filters
    const now = new Date()
    const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
    const where: Prisma.QuoteWhereInput = {
      ...(contains && { OR: [{ reference: contains }, { customerName: contains }, { customerEmail: contains }, { tradeCompanyName: contains }] }),
      ...(status && statusWhere(status, now)),
      ...(trade && { tradeCompanyName: trade === "true" ? { not: null } : null }),
      ...(madeBy && { createdById: madeBy === "staff" ? { not: null } : null }),
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
          createdBy: { select: { name: true, email: true } },
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
          customer: { name: quote.customerName, email: quote.customerEmail, phone: quote.customerPhone },
          tradeCompanyName: quote.tradeCompanyName,
          lineCount: quote._count.items,
          totalGhs: quote.totalGhs.toFixed(2),
          status: statusOf(quote, now),
          // validUntil is the start of the day after the last one its prices hold
          validUntil: new Date(quote.validUntil.getTime() - 1),
          order: quote.order,
          createdBy: quote.createdBy && (quote.createdBy.name || quote.createdBy.email),
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

const statusOf = (quote: { status: QuoteStatus; validUntil: Date }, now: Date) =>
  quote.status === QuoteStatus.OPEN ? (quote.validUntil > now ? "open" : "expired") : quote.status === QuoteStatus.ACCEPTED ? "accepted" : "cancelled"

// One quotation for its console page: the lines and amounts as they were quoted
export const getQuoteDetails = async (quoteId: string): Promise<DataResponse<QuoteDetails>> => {
  try {
    const session = await consoleAuth.api.getSession({ headers: await headers() })
    if (!session || !hasSystemPermission(session.user.role, { order: ["read"] })) return { success: false, error: "Unauthorized" }

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        items: { orderBy: { id: "asc" } },
        order: { select: { id: true, reference: true } },
        createdBy: { select: { name: true, email: true } },
      },
    })
    if (!quote) return { success: false, error: "Quotation not found.", code: "NOT_FOUND" }

    // Whether an account has its email, verified, and so can accept it on the storefront
    const owner = quote.userId ? true : (await prisma.user.count({ where: { email: { equals: quote.customerEmail, mode: "insensitive" }, emailVerified: true } })) > 0
    const ghs = (amount: Prisma.Decimal) => amount.toFixed(2)

    return {
      success: true,
      data: {
        id: quote.id,
        reference: quote.reference,
        url: quoteUrl(quote.reference, quote.id),
        status: statusOf(quote, new Date()),
        createdAt: quote.createdAt,
        validUntil: new Date(quote.validUntil.getTime() - 1),
        createdBy: quote.createdBy && (quote.createdBy.name || quote.createdBy.email),
        customer: { name: quote.customerName, email: quote.customerEmail, phone: quote.customerPhone, hasAccount: owner },
        trade: quote.tradeCompanyName ? { companyName: quote.tradeCompanyName, tin: quote.tradeTin } : null,
        address: [quote.shippingLine1, quote.shippingLine2, quote.shippingTown, quote.shippingRegion].filter(Boolean).join(", "),
        notes: quote.notes,
        exchangeRate: quote.exchangeRate.toString(),
        lines: quote.items.map((item) => ({
          id: item.id,
          label: item.variantDescription ? `${item.productName} (${item.variantDescription})` : item.productName,
          href: item.productId && catalogueProductHref(item.productId),
          sku: item.sku,
          storeName: item.storeName,
          quantity: item.quantity,
          unitPriceGhs: ghs(item.unitPriceGhs),
          totalPriceGhs: ghs(item.totalPriceGhs),
          installationGhs: item.installationUnitGhs ? ghs(item.installationTotalGhs) : null,
        })),
        totals: {
          subtotalGhs: ghs(quote.subtotalGhs),
          discountAmountGhs: quote.discountAmountGhs?.gt(0) ? ghs(quote.discountAmountGhs) : null,
          discountReason: quote.discountReason,
          installationGhs: ghs(quote.installationGhs),
          shippingGhs: ghs(quote.shippingGhs),
          taxRate: quote.taxRate.toString(),
          taxGhs: ghs(quote.taxGhs),
          totalGhs: ghs(quote.totalGhs),
        },
        order: quote.order,
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// A quotation as the create form's starting values, for "Copy to a new quotation": its customer, items, address,
// discount and note, priced again at today's prices. Lines whose listing has gone since are left out.
export const getQuoteCopy = async (quoteId: string): Promise<QuoteCopy | null> => {
  const session = await consoleAuth.api.getSession({ headers: await headers() })
  if (!session || !hasSystemPermission(session.user.role, { order: ["create"] })) return null

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: { orderBy: { id: "asc" } },
      user: { select: { id: true, name: true, email: true, phone: true, addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }], select: addressSelect } } },
    },
  })
  if (!quote) return null

  const items = quote.items.filter((item) => item.storeListingId && (!item.hasVariant || item.storeListingVariantId))
  const trade = await loadTradeTerms(prisma, quote.userId)
  return {
    customer: quote.user && {
      ...quote.user,
      trade: trade && { percent: trade.percent.toString(), companyName: trade.companyName },
    },
    values: {
      customerUserId: quote.userId,
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      customerPhone: quote.customerPhone,
      items: items.map((item) => ({ listingId: item.storeListingId!, listingVariantId: item.storeListingVariantId, quantity: item.quantity, installation: !!item.installationUnitGhs })),
      shippingLine1: quote.shippingLine1,
      shippingLine2: quote.shippingLine2 ?? "",
      shippingRegion: quote.shippingRegion,
      shippingTown: quote.shippingTown,
      shippingGhs: quote.shippingGhs.toNumber(),
      notes: quote.notes ?? "",
      discountType: quote.discountType ?? "NONE",
      discountValue: quote.discountValue?.toNumber() ?? 0,
      discountReason: quote.discountReason ?? "",
    },
    chosen: Object.fromEntries(
      items.map((item) => [
        `${item.storeListingId}:${item.storeListingVariantId ?? ""}`,
        {
          label: item.variantDescription ? `${item.productName} (${item.variantDescription})` : item.productName,
          sku: item.sku,
          priceGhs: null,
          stock: null,
          installationFeeGhs: item.installationUnitGhs?.toFixed(2) ?? null,
        },
      ])
    ),
    left: quote.items.length - items.length,
    reference: quote.reference,
  }
}

// As the customer lookup returns them
const addressSelect = { id: true, name: true, phone: true, line1: true, line2: true, region: true, town: true, isDefault: true } satisfies Prisma.AddressSelect
