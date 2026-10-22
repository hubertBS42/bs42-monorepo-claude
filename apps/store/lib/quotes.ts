import "server-only"

import type { PricingContext } from "@workspace/commerce/exchange-rates"
import { createOrder, OrderItemError, resolveOrderLines, type ResolvedLine } from "@workspace/commerce/order-writes"
import type { PricedOrder } from "@workspace/commerce/pricing"
import { tradeDiscount, type TradeTerms } from "@workspace/commerce/trade-accounts"
import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { PaymentMethod, QuoteStatus, ShippingMethod } from "@workspace/db/enums"
import { dayStart, formatDate } from "@workspace/utils/date"

import { CheckoutError, checkUnpaidLimits, priceCheckout } from "./checkout"

// Quotations: the basket priced as checkout would price it, with its GHS amounts fixed until the quote lapses (its
// stock isn't held), and accepting one, which places the order at those amounts once every line is still on sale and in
// stock. In its own module, with relative imports, so it can be tested against the database without a request.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx

// Open quotes an account can hold at once. They hold no stock, so this only keeps the list sensible.
export const MAX_OPEN_QUOTES = 5

const MESSAGES = {
  TOO_MANY_QUOTES: `You already have ${MAX_OPEN_QUOTES} open quotations. Cancel one, or let it lapse, to make another.`,
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

  constructor(code: QuoteErrorCode, items: string[] = []) {
    super(items.length ? `${MESSAGES[code]} ${items.join("; ")}.` : MESSAGES[code])
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

export interface NewQuote {
  userId: string
  email: string
  // Who it's addressed to, and the delivery the order would make
  name: string
  phone: string
  line1: string
  line2: string
  region: string
  town: string
  validityDays: number
  trade: TradeTerms | null
}

// Makes a quotation from the basket, priced for delivery to the address, in the caller's transaction. Throws
// QuoteError (too many open), CheckoutError (an empty or changed basket, no delivery or installation there) or
// OrderItemError (a line can't be sold). The basket stays as it is.
export async function createQuote(tx: Tx, sessionCartId: string, pricing: PricingContext, input: NewQuote) {
  if ((await tx.quote.count({ where: { userId: input.userId, ...openQuoteWhere() } })) >= MAX_OPEN_QUOTES) throw new QuoteError("TOO_MANY_QUOTES")

  const { basket, lines, priced } = await priceCheckout(tx, sessionCartId, pricing, input, input.trade)
  // loadCart moved, lowered or dropped lines: the customer hasn't seen this basket
  if (basket.notices.length) throw new CheckoutError("BASKET_CHANGED")

  // QT-20261022-00012, numbered by a sequence (see its migration)
  const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('quote_reference_seq')`
  const reference = `QT-${formatDate(new Date(), "yyyyMMdd")}-${String(nextval).padStart(5, "0")}`
  const discount = input.trade && tradeDiscount(input.trade)

  return tx.quote.create({
    data: {
      reference,
      userId: input.userId,
      customerName: input.name,
      customerEmail: input.email.toLowerCase(),
      customerPhone: input.phone,
      shippingLine1: input.line1,
      shippingLine2: input.line2 || null,
      shippingRegion: input.region,
      shippingTown: input.town,
      tradeAccountId: input.trade?.accountId ?? null,
      tradeCompanyName: input.trade?.companyName ?? null,
      tradeTin: input.trade?.tin ?? null,
      validUntil: quoteValidUntil(input.validityDays),
      subtotalUsd: priced.subtotalUsd,
      subtotalGhs: priced.subtotalGhs,
      discountType: discount?.type ?? null,
      discountValue: discount?.value ?? null,
      discountAmountGhs: priced.discountAmountGhs,
      discountReason: discount?.reason ?? null,
      shippingGhs: priced.shippingGhs,
      installationGhs: priced.installationGhs,
      taxRate: priced.taxRate,
      taxGhs: priced.taxGhs,
      totalGhs: priced.totalGhs,
      exchangeRate: new Prisma.Decimal(pricing.rate.rate),
      exchangeRateId: pricing.rate.id,
      items: {
        create: lines.map((line, index) => {
          const amounts = priced.lines[index]!
          return {
            organizationId: line.storeId,
            storeListingId: line.listingId,
            storeListingVariantId: line.listingVariantId,
            productId: line.productId,
            productVariantId: line.productVariantId,
            hasVariant: !!line.listingVariantId,
            quantity: line.quantity,
            ...amounts,
            productName: line.productName,
            productSlug: line.productSlug,
            productImage: line.productImage,
            variantDescription: line.variantDescription,
            sku: line.sku,
            storeName: line.storeName,
          }
        }),
      },
    },
    select: { id: true, reference: true },
  })
}

// Cancels one of the customer's open quotes. Throws NOT_OPEN when it was accepted or cancelled meanwhile.
export async function cancelQuote(client: Client, userId: string, quoteId: string) {
  const { count } = await client.quote.updateMany({ where: { id: quoteId, userId, status: QuoteStatus.OPEN }, data: { status: QuoteStatus.CANCELLED } })
  if (count === 0) throw new QuoteError((await client.quote.count({ where: { id: quoteId, userId } })) ? "NOT_OPEN" : "NOT_FOUND")
}

const quoteForOrderInclude = { items: { orderBy: { id: "asc" } } } satisfies Prisma.QuoteInclude
type QuoteForOrder = Prisma.QuoteGetPayload<{ include: typeof quoteForOrderInclude }>

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

// Each line as an order would sell it today (on sale, its installation still offered), or the reasons it can't be
// supplied: every one, so the customer hears of them all at once
async function resolveQuotedLines(tx: Tx, quote: QuoteForOrder) {
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
  return { lines, problems }
}

// Places the order a quote describes, at its prices, and marks the quote accepted, in the caller's transaction. Only
// its owner, while it's open and hasn't lapsed. Throws QuoteError, CheckoutError (TOO_MANY_UNPAID), or OrderItemError
// when another order took the last of something meanwhile.
export async function acceptQuote(tx: Tx, quoteId: string, userId: string, ip: string | null) {
  // Locked, so two clicks can't place two orders
  await tx.$queryRaw`SELECT 1 FROM "quote" WHERE "id" = ${quoteId}::uuid FOR UPDATE`
  const quote = await tx.quote.findFirst({ where: { id: quoteId, userId }, include: quoteForOrderInclude })
  if (!quote) throw new QuoteError("NOT_FOUND")
  if (quote.status !== QuoteStatus.OPEN) throw new QuoteError("NOT_OPEN")
  if (isExpired(quote)) throw new QuoteError("EXPIRED")
  if (!quote.exchangeRateId) throw new QuoteError("NOT_FOUND")

  await checkUnpaidLimits(tx, { email: quote.customerEmail, phone: quote.customerPhone, ip })

  const { lines, problems } = await resolveQuotedLines(tx, quote)
  if (problems.length) throw new QuoteError("UNAVAILABLE", problems)

  const order = await createOrder(tx, {
    createdById: null,
    placedFromIp: ip,
    statusNote: `Placed from quotation ${quote.reference}`,
    customer: { userId, name: quote.customerName, email: quote.customerEmail, phone: quote.customerPhone },
    shippingMethod: ShippingMethod.DELIVERY,
    paymentMethod: PaymentMethod.CARD,
    shipping: { name: quote.customerName, phone: quote.customerPhone, line1: quote.shippingLine1, line2: quote.shippingLine2, region: quote.shippingRegion, town: quote.shippingTown },
    notes: null,
    discount: quote.discountType && quote.discountValue ? { type: quote.discountType, value: quote.discountValue, reason: quote.discountReason ?? "Discount" } : null,
    trade: quote.tradeAccountId && quote.tradeCompanyName ? { accountId: quote.tradeAccountId, companyName: quote.tradeCompanyName, tin: quote.tradeTin ?? "" } : null,
    rate: { id: quote.exchangeRateId, value: quote.exchangeRate },
    lines,
    priced: quotedPrices(quote),
  })
  await tx.quote.update({ where: { id: quote.id }, data: { status: QuoteStatus.ACCEPTED, orderId: order.id } })
  return order
}
