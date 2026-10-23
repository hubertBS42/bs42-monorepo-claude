import "server-only"

import type { PricingContext } from "@workspace/commerce/exchange-rates"
import { loadInstallationAreas, loadInstallationFees } from "@workspace/commerce/installation"
import { installsIn } from "@workspace/commerce/installation-areas"
import { describeVariant, resolveOrderLines } from "@workspace/commerce/order-writes"
import { priceOrder } from "@workspace/commerce/pricing"
import { lockOpenQuote, nextQuoteReference, placeQuotedOrder, QuoteError, quoteValidUntil } from "@workspace/commerce/quotes"
import { loadTradeTerms } from "@workspace/commerce/trade-accounts"
import { customerVisibleListingWhere, loadVisibleCategoryIds, variantOnSaleWhere } from "@workspace/commerce/visibility"
import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { PaymentMethod, QuoteStatus } from "@workspace/db/enums"
import { OPEN_PURCHASE_ORDER_STATUSES } from "./purchase-order-status"

// Quotations staff make in the console (the shared rules are in @workspace/commerce/quotes): finding what to quote
// across every store, pricing it as the storefront would, saving it, and placing the order from it for a customer
// who pays by bank transfer. Orders staff make (staff-orders.ts) find and price their items the same way. In its own
// module, with relative imports, so it can be tested against the database.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx

const MESSAGES = {
  // The town, not the items: OrderItemError's NO_INSTALLATION is a product that stopped offering it
  OUTSIDE_INSTALLATION_AREAS: "We don't install in that town. Take installation off the items, or choose another address.",
  PRICE_CHANGED: "The prices changed since you reviewed the order. Check the new total, then create it again.",
  DISCOUNT_TOO_LARGE: "The discount is more than the items cost.",
  CUSTOMER_NOT_FOUND: "That customer's account no longer exists. Look them up again.",
}

export class StaffQuoteError extends Error {
  readonly code: keyof typeof MESSAGES

  constructor(code: keyof typeof MESSAGES) {
    super(MESSAGES[code])
    this.code = code
  }
}

// ============================================
// FINDING WHAT TO QUOTE
// ============================================

export const MAX_QUOTABLE_PRODUCTS = 30

export interface QuotableRow {
  listingId: string
  listingVariantId: string | null
  variantDescription: string | null
  sku: string | null
  // One unit before tax, in GHS at today's rate
  priceGhs: string
  // Null when the store doesn't track it
  stock: number | null
  // Still to come on the store's open purchase orders
  incoming: number
  storeName: string
}

export interface QuotableProduct {
  productId: string
  productName: string
  brandName: string
  image: string | null
  // Installing one unit, in GHS; null when the product doesn't offer it
  installationFeeGhs: string | null
  // One per variant on sale (one for a product without variants)
  rows: QuotableRow[]
}

type Candidate = QuotableRow & { priceUsd: Prisma.Decimal }

const inStock = (candidate: Candidate) => candidate.stock === null || candidate.stock > 0

// The storefront's choice among the stores selling the same thing: in stock, else on its way, else any; the cheapest
// of those, with the listing id breaking ties so the choice is the same every time
function pickOffer(candidates: Candidate[]) {
  const rank = (candidate: Candidate) => (inStock(candidate) ? 0 : candidate.incoming > 0 ? 1 : 2)
  return [...candidates].sort((a, b) => rank(a) - rank(b) || a.priceUsd.comparedTo(b.priceUsd) || (a.listingId < b.listingId ? -1 : 1))[0]!
}

// Products customers can buy whose name, SKU or variant SKU matches, each variant with the offer the storefront would
// sell (customers never see which store it comes from). Prices are before tax, at today's rate.
export async function searchQuotableItems(client: Client, pricing: PricingContext, search: string): Promise<QuotableProduct[]> {
  const visibleCategoryIds = await loadVisibleCategoryIds(client)
  const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
  const listings = await client.storeListing.findMany({
    where: {
      AND: [customerVisibleListingWhere(visibleCategoryIds), ...(contains ? [{ product: { OR: [{ name: contains }, { sku: contains }, { variants: { some: { sku: contains } } }] } }] : [])],
    },
    orderBy: [{ product: { name: "asc" } }, { id: "asc" }],
    // Every store's listing of a product counts towards this, so it's well above the number of products shown
    take: MAX_QUOTABLE_PRODUCTS * 5,
    select: {
      id: true,
      sellPrice: true,
      stock: true,
      trackInventory: true,
      organization: { select: { name: true } },
      product: { select: { id: true, name: true, sku: true, images: true, hasVariants: true, brand: { select: { name: true } } } },
      storeListingVariants: {
        where: variantOnSaleWhere,
        select: {
          id: true,
          sellPrice: true,
          stock: true,
          trackInventory: true,
          variant: {
            select: { id: true, sku: true, position: true, variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } } },
          },
        },
      },
    },
  })

  // Ordered less received on open purchase orders, per listing row
  const incomingRows = await client.purchaseOrderItem.groupBy({
    by: ["storeListingId", "storeListingVariantId"],
    where: { storeListingId: { in: listings.map((listing) => listing.id) }, purchaseOrder: { status: { in: OPEN_PURCHASE_ORDER_STATUSES } } },
    _sum: { quantityOrdered: true, quantityReceived: true },
  })
  const incoming = new Map(incomingRows.map((row) => [`${row.storeListingId}:${row.storeListingVariantId ?? ""}`, (row._sum.quantityOrdered ?? 0) - (row._sum.quantityReceived ?? 0)]))

  const rate = new Prisma.Decimal(pricing.rate.rate)
  const toGhs = (usd: Prisma.Decimal) => usd.times(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2)

  // Candidates per product, then per variant, in the order the listings came back (by product name)
  const products = new Map<string, { product: (typeof listings)[number]["product"]; variants: Map<string, { position: number; candidates: Candidate[] }> }>()
  for (const listing of listings) {
    const { product } = listing
    const entry = products.get(product.id) ?? { product, variants: new Map() }
    products.set(product.id, entry)
    const add = (key: string, position: number, candidate: Candidate) => {
      const variant = entry.variants.get(key) ?? { position, candidates: [] }
      variant.candidates.push(candidate)
      entry.variants.set(key, variant)
    }
    const store = { storeName: listing.organization.name, listingId: listing.id }

    if (!product.hasVariants) {
      add("", 0, {
        ...store,
        listingVariantId: null,
        variantDescription: null,
        sku: product.sku,
        priceUsd: listing.sellPrice,
        priceGhs: toGhs(listing.sellPrice),
        stock: listing.trackInventory ? listing.stock : null,
        incoming: incoming.get(`${listing.id}:`) ?? 0,
      })
      continue
    }
    for (const row of listing.storeListingVariants) {
      // A variant without its own price sells at the listing's, and neither may be 0
      const priceUsd = row.sellPrice ?? listing.sellPrice
      if (priceUsd.lte(0)) continue
      add(row.variant.id, row.variant.position, {
        ...store,
        listingVariantId: row.id,
        variantDescription: describeVariant(row.variant.variantValues),
        sku: row.variant.sku,
        priceUsd,
        priceGhs: toGhs(priceUsd),
        stock: row.trackInventory ? row.stock : null,
        incoming: incoming.get(`${listing.id}:${row.id}`) ?? 0,
      })
    }
  }

  const shown = [...products.values()].filter((entry) => entry.variants.size > 0).slice(0, MAX_QUOTABLE_PRODUCTS)
  const fees = await loadInstallationFees(
    client,
    shown.map((entry) => entry.product.id)
  )
  return shown.map(({ product, variants }) => ({
    productId: product.id,
    productName: product.name,
    brandName: product.brand.name,
    image: product.images[0] ?? null,
    installationFeeGhs: fees.get(product.id)?.toFixed(2) ?? null,
    rows: [...variants.values()]
      .sort((a, b) => a.position - b.position)
      .map(({ candidates }) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the USD price is only for choosing
        const { priceUsd, ...row } = pickOffer(candidates)
        return row
      }),
  }))
}

// ============================================
// PRICING AND SAVING
// ============================================

export interface StaffQuoteLine {
  listingId: string
  listingVariantId: string | null
  quantity: number
  installation: boolean
}

export interface StaffSalePricingInput {
  items: StaffQuoteLine[]
  region: string
  town: string
  // Set by staff, filled in from the delivery fees
  shippingGhs: Prisma.Decimal
  discount: { type: "FIXED" | "PERCENTAGE"; value: Prisma.Decimal; reason: string } | null
}

// The lines as the storefront would sell them (any store's published listings customers can see) and their prices,
// for a staff-made quote or order. Throws OrderItemError for a line that can't be sold, or StaffQuoteError.
export async function priceStaffSale(client: Client, pricing: PricingContext, input: StaffSalePricingInput) {
  const lines = await resolveOrderLines(client, null, input.items)
  if (lines.some((line) => line.installationUnitGhs) && !installsIn(await loadInstallationAreas(client), input.region, input.town)) throw new StaffQuoteError("OUTSIDE_INSTALLATION_AREAS")

  const priced = priceOrder({ lines, exchangeRate: new Prisma.Decimal(pricing.rate.rate), shippingGhs: input.shippingGhs, discount: input.discount, tax: pricing.tax })
  if (input.discount?.type === "FIXED" && input.discount.value.gt(priced.subtotalGhs)) throw new StaffQuoteError("DISCOUNT_TOO_LARGE")
  return { lines, priced }
}

export interface NewStaffQuote extends StaffSalePricingInput {
  // The customer's account, when staff found them by email or phone
  customerUserId: string | null
  name: string
  email: string
  phone: string
  line1: string
  line2: string
  validityDays: number
  // Printed on the quote for the customer
  notes: string
}

// Saves a quote made by a staff member, in the caller's transaction. An approved trade account's company and TIN go on
// it as on the customer's own; its discount is whatever staff set (the form starts from the account's).
export async function createStaffQuote(tx: Tx, pricing: PricingContext, input: NewStaffQuote, staffId: string) {
  if (input.customerUserId && !(await tx.user.findUnique({ where: { id: input.customerUserId }, select: { id: true } }))) throw new StaffQuoteError("CUSTOMER_NOT_FOUND")
  const trade = await loadTradeTerms(tx, input.customerUserId)
  const { lines, priced } = await priceStaffSale(tx, pricing, input)

  return tx.quote.create({
    data: {
      reference: await nextQuoteReference(tx),
      userId: input.customerUserId,
      createdById: staffId,
      notes: input.notes || null,
      customerName: input.name,
      customerEmail: input.email.toLowerCase(),
      customerPhone: input.phone,
      shippingLine1: input.line1,
      shippingLine2: input.line2 || null,
      shippingRegion: input.region,
      shippingTown: input.town,
      tradeAccountId: trade?.accountId ?? null,
      tradeCompanyName: trade?.companyName ?? null,
      tradeTin: trade?.tin ?? null,
      validUntil: quoteValidUntil(input.validityDays),
      subtotalUsd: priced.subtotalUsd,
      subtotalGhs: priced.subtotalGhs,
      discountType: input.discount?.type ?? null,
      discountValue: input.discount?.value ?? null,
      discountAmountGhs: priced.discountAmountGhs,
      discountReason: input.discount?.reason ?? null,
      shippingGhs: priced.shippingGhs,
      installationGhs: priced.installationGhs,
      taxRate: priced.taxRate,
      taxGhs: priced.taxGhs,
      totalGhs: priced.totalGhs,
      exchangeRate: new Prisma.Decimal(pricing.rate.rate),
      exchangeRateId: pricing.rate.id,
      items: {
        create: lines.map((line, index) => ({
          organizationId: line.storeId,
          storeListingId: line.listingId,
          storeListingVariantId: line.listingVariantId,
          productId: line.productId,
          productVariantId: line.productVariantId,
          hasVariant: !!line.listingVariantId,
          quantity: line.quantity,
          ...priced.lines[index]!,
          productName: line.productName,
          productSlug: line.productSlug,
          productImage: line.productImage,
          variantDescription: line.variantDescription,
          sku: line.sku,
          storeName: line.storeName,
        })),
      },
    },
    select: { id: true, reference: true },
  })
}

// ============================================
// ACCEPTING AND CANCELLING
// ============================================

// Places the order a quote describes, at its prices, for a customer paying by bank transfer, and marks the quote
// accepted, in the caller's transaction. The order is staff-made, so the unpaid-order job leaves it for staff to
// record the payment. Throws QuoteError, or OrderItemError when another order took the last of something meanwhile.
export async function placeOrderFromQuote(tx: Tx, quoteId: string, staffId: string) {
  const quote = await lockOpenQuote(tx, quoteId, null)
  return placeQuotedOrder(tx, quote, { createdById: staffId, userId: quote.userId, paymentMethod: PaymentMethod.BANK_TRANSFER })
}

// Cancels an open quote (lapsed or not). Throws QuoteError (NOT_OPEN) when it was accepted or cancelled meanwhile.
export async function cancelStaffQuote(client: Client, quoteId: string) {
  const { count } = await client.quote.updateMany({ where: { id: quoteId, status: QuoteStatus.OPEN }, data: { status: QuoteStatus.CANCELLED } })
  if (count === 0) throw new QuoteError((await client.quote.count({ where: { id: quoteId } })) ? "NOT_OPEN" : "NOT_FOUND")
}
