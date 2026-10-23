import "server-only"

import type { PricingContext } from "@workspace/commerce/exchange-rates"
import { lockOpenQuote, nextQuoteReference, openQuoteWhere, placeQuotedOrder, QuoteError, quoteOwnerWhere, quoteValidUntil, type QuoteViewer } from "@workspace/commerce/quotes"
import { tradeDiscount, type TradeTerms } from "@workspace/commerce/trade-accounts"
import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { PaymentMethod, QuoteStatus } from "@workspace/db/enums"

import { CheckoutError, checkUnpaidLimits, priceCheckout } from "./checkout"

// The storefront's side of quotations (the shared rules are in @workspace/commerce/quotes): making one from the basket,
// priced as checkout would price it, and cancelling or accepting one the customer owns. In its own module, with
// relative imports, so it can be tested against the database without a request.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx

// Open quotes an account can make for itself at once. They hold no stock, so this only keeps the list sensible. Quotes
// staff make for the customer don't count.
export const MAX_OPEN_QUOTES = 5

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
  if ((await tx.quote.count({ where: { userId: input.userId, createdById: null, ...openQuoteWhere() } })) >= MAX_OPEN_QUOTES) {
    throw new QuoteError("TOO_MANY_QUOTES", [], `You already have ${MAX_OPEN_QUOTES} open quotations. Cancel one, or let it lapse, to make another.`)
  }

  const { basket, lines, priced } = await priceCheckout(tx, sessionCartId, pricing, input, input.trade)
  // loadCart moved, lowered or dropped lines: the customer hasn't seen this basket
  if (basket.notices.length) throw new CheckoutError("BASKET_CHANGED")

  const discount = input.trade && tradeDiscount(input.trade)
  return tx.quote.create({
    data: {
      reference: await nextQuoteReference(tx),
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

// Cancels one of the customer's open quotes, including one staff made for them. Throws NOT_OPEN when it was accepted
// or cancelled meanwhile.
export async function cancelQuote(client: Client, viewer: QuoteViewer, quoteId: string) {
  const owned = { id: quoteId, ...quoteOwnerWhere(viewer) }
  const { count } = await client.quote.updateMany({ where: { ...owned, status: QuoteStatus.OPEN }, data: { status: QuoteStatus.CANCELLED } })
  if (count === 0) throw new QuoteError((await client.quote.count({ where: owned })) ? "NOT_OPEN" : "NOT_FOUND")
}

// Places the order a quote describes, at its prices, and marks the quote accepted, in the caller's transaction. Only
// its owner, while it's open and hasn't lapsed. Throws QuoteError, CheckoutError (TOO_MANY_UNPAID), or OrderItemError
// when another order took the last of something meanwhile.
export async function acceptQuote(tx: Tx, quoteId: string, viewer: QuoteViewer, ip: string | null) {
  const quote = await lockOpenQuote(tx, quoteId, viewer)
  await checkUnpaidLimits(tx, { email: quote.customerEmail, phone: quote.customerPhone, ip })
  // Paid online, like checkout's: the payment sets card or mobile money
  return placeQuotedOrder(tx, quote, { createdById: null, userId: viewer.id, placedFromIp: ip, paymentMethod: PaymentMethod.CARD })
}
