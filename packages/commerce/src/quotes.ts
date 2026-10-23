import "server-only"

import type { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { type PaymentMethod, QuoteStatus, ShippingMethod } from "@workspace/db/enums"
import { dayStart, formatDate } from "@workspace/utils/date"
import { createOrder, OrderItemError, resolveOrderLines, type ResolvedLine } from "./order-writes"
import type { PricedOrder } from "./pricing"

// Quotations, as both apps need them: customers make them from their basket on the storefront (apps/store/lib/quotes.ts)
// and staff make them in the console. Either way a quote holds its GHS amounts until it lapses (its stock isn't held),
// and accepting it places the order at those amounts once every line is still on sale and in stock. In its own module,
// with relative imports, so it can be tested against the database without a request.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const MESSAGES = {
  TOO_MANY_QUOTES: "You already have too many open quotations. Cancel one, or let it lapse, to make another.",
  NOT_FOUND: "We can't find that quotation.",
  NOT_OPEN: "This quotation has already been accepted or cancelled.",
  EXPIRED: "This quotation has lapsed, so its prices no longer hold.",
  UNAVAILABLE: "Some of this quotation can't be supplied now.",
}

export type QuoteErrorCode = keyof typeof MESSAGES

export class QuoteError extends Error {
  readonly code: QuoteErrorCode
  // For UNAVAILABLE: what can't be supplied, e.g. "Tee (Size: M): only 2 left"
  readonly items: string[]

  constructor(code: QuoteErrorCode, items: string[] = [], message?: string) {
    const text = message ?? MESSAGES[code]
    super(items.length ? `${text} ${items.join("; ")}.` : text)
    this.code = code
    this.items = items
  }
}

// Open, and not past its date
export const openQuoteWhere = (now = new Date()) => ({ status: QuoteStatus.OPEN, validUntil: { gt: now } }) satisfies Prisma.QuoteWhereInput

export const isExpired = (quote: { status: QuoteStatus; validUntil: Date }, now = new Date()) => quote.status === QuoteStatus.OPEN && quote.validUntil <= now

// The last day a quote made today holds, as a whole day: until the end of the day `days` from today, in Accra time
export function quoteValidUntil(days: number, now = new Date()) {
  return dayStart(formatDate(now, "yyyy-MM-dd"), days + 1)
}

// QT-20261022-00012, numbered by a sequence (see its migration); gaps are expected, as nextval doesn't roll back
export async function nextQuoteReference(tx: Tx) {
  const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('quote_reference_seq')`
  return `QT-${formatDate(new Date(), "yyyyMMdd")}-${String(nextval).padStart(5, "0")}`
}

export interface QuoteViewer {
  id: string
  email: string
  emailVerified: boolean
}

// The quotes a customer's account owns: those it made, and those addressed to its email (staff make quotes for an
// email, not an account). As with orders (customer-orders.ts), only a verified email counts, or anyone could take a
// stranger's quote by signing up with their address.
export function quoteOwnerWhere(viewer: QuoteViewer): Prisma.QuoteWhereInput {
  if (!viewer.emailVerified) return { userId: viewer.id }
  return { OR: [{ userId: viewer.id }, { customerEmail: { equals: viewer.email, mode: "insensitive" } }] }
}

// The same rule for a loaded quote
export function isQuoteOwner(quote: { userId: string | null; customerEmail: string }, viewer: QuoteViewer | null) {
  if (!viewer) return false
  return quote.userId === viewer.id || (viewer.emailVerified && quote.customerEmail.toLowerCase() === viewer.email.toLowerCase())
}

const quoteForOrderInclude = { items: { orderBy: { id: "asc" } } } satisfies Prisma.QuoteInclude
export type QuoteForOrder = Prisma.QuoteGetPayload<{ include: typeof quoteForOrderInclude }>

// The quote, locked so two clicks can't place two orders, while it can still be accepted. Throws QuoteError otherwise.
export async function lockOpenQuote(tx: Tx, quoteId: string, owner: QuoteViewer | null): Promise<QuoteForOrder> {
  await tx.$queryRaw`SELECT 1 FROM "quote" WHERE "id" = ${quoteId}::uuid FOR UPDATE`
  const quote = await tx.quote.findFirst({ where: { id: quoteId, ...(owner && quoteOwnerWhere(owner)) }, include: quoteForOrderInclude })
  if (!quote || !quote.exchangeRateId) throw new QuoteError("NOT_FOUND")
  if (quote.status !== QuoteStatus.OPEN) throw new QuoteError("NOT_OPEN")
  if (isExpired(quote)) throw new QuoteError("EXPIRED")
  return quote
}

// The quote's stored amounts, as createOrder takes them: the order charges what the quote said
function quotedPrices(quote: QuoteForOrder): PricedOrder {
  return {
    lines: quote.items.map((item) => ({
      unitPriceUsd: item.unitPriceUsd,
      totalPriceUsd: item.totalPriceUsd,
      unitPriceGhs: item.unitPriceGhs,
      totalPriceGhs: item.totalPriceGhs,
      discountGhs: item.discountGhs,
      taxGhs: item.taxGhs,
      installationUnitGhs: item.installationUnitGhs,
      installationTotalGhs: item.installationTotalGhs,
      installationTaxGhs: item.installationTaxGhs,
    })),
    subtotalUsd: quote.subtotalUsd,
    subtotalGhs: quote.subtotalGhs,
    discountAmountGhs: quote.discountAmountGhs,
    shippingGhs: quote.shippingGhs,
    installationGhs: quote.installationGhs,
    taxRate: quote.taxRate,
    taxGhs: quote.taxGhs,
    totalGhs: quote.totalGhs,
  }
}

const itemLabel = (item: { productName: string; variantDescription: string | null }) => (item.variantDescription ? `${item.productName} (${item.variantDescription})` : item.productName)

// Each line as an order would sell it today (on sale, its installation still offered, in stock), or the reasons it
// can't be supplied: every one, so the customer hears of them all at once. Throws QuoteError (UNAVAILABLE).
export async function resolveQuotedLines(tx: Tx, quote: QuoteForOrder) {
  const lines: ResolvedLine[] = []
  const problems: string[] = []
  for (const item of quote.items) {
    const label = itemLabel(item)
    // A listing, or the variant it was quoted by, that's been deleted since
    if (!item.storeListingId || (item.hasVariant && !item.storeListingVariantId)) {
      problems.push(`${label}: no longer on sale`)
      continue
    }
    try {
      const [line] = await resolveOrderLines(tx, null, [
        { listingId: item.storeListingId, listingVariantId: item.storeListingVariantId, quantity: item.quantity, installation: !!item.installationUnitGhs },
      ])
      // Checked again when the stock is reserved, which another order may beat this one to
      if (line!.trackInventory && line!.stock < item.quantity) problems.push(line!.stock > 0 ? `${label}: only ${line!.stock} left` : `${label}: out of stock`)
      else lines.push(line!)
    } catch (error) {
      if (!(error instanceof OrderItemError)) throw error
      problems.push(error.code === "NO_INSTALLATION" ? `${label}: installation no longer offered` : `${label}: no longer on sale`)
    }
  }
  if (problems.length) throw new QuoteError("UNAVAILABLE", problems)
  return lines
}

export interface QuotedOrder {
  // Null when the customer accepts it on the storefront; the staff member placing it in the console otherwise
  createdById: string | null
  // The account the order is listed under
  userId: string | null
  placedFromIp?: string | null
  // How the customer means to pay: online for the storefront, else what staff expect (they record the payment)
  paymentMethod: PaymentMethod
}

// Places the order a locked quote describes (lockOpenQuote), at its prices and rate, and marks the quote accepted, in
// the caller's transaction. Throws QuoteError (UNAVAILABLE) or OrderItemError when another order took the last of
// something meanwhile.
export async function placeQuotedOrder(tx: Tx, quote: QuoteForOrder, placed: QuotedOrder) {
  const lines = await resolveQuotedLines(tx, quote)
  const order = await createOrder(tx, {
    createdById: placed.createdById,
    placedFromIp: placed.placedFromIp ?? null,
    statusNote: `Placed from quotation ${quote.reference}`,
    customer: { userId: placed.userId, name: quote.customerName, email: quote.customerEmail, phone: quote.customerPhone },
    shippingMethod: ShippingMethod.DELIVERY,
    paymentMethod: placed.paymentMethod,
    shipping: { name: quote.customerName, phone: quote.customerPhone, line1: quote.shippingLine1, line2: quote.shippingLine2, region: quote.shippingRegion, town: quote.shippingTown },
    notes: null,
    discount: quote.discountType && quote.discountValue ? { type: quote.discountType, value: quote.discountValue, reason: quote.discountReason ?? "Discount" } : null,
    trade: quote.tradeAccountId && quote.tradeCompanyName ? { accountId: quote.tradeAccountId, companyName: quote.tradeCompanyName, tin: quote.tradeTin ?? "" } : null,
    rate: { id: quote.exchangeRateId!, value: quote.exchangeRate },
    lines,
    priced: quotedPrices(quote),
  })
  await tx.quote.update({ where: { id: quote.id }, data: { status: QuoteStatus.ACCEPTED, orderId: order.id } })
  return order
}
