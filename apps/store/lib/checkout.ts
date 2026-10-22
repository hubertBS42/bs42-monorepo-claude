import "server-only"

import { quoteDelivery, loadDeliverySettings, type DeliveryQuote } from "@workspace/commerce/delivery"
import type { PricingContext } from "@workspace/commerce/exchange-rates"
import { loadInstallationAreas } from "@workspace/commerce/installation"
import { installsIn } from "@workspace/commerce/installation-areas"
import { createOrder, resolveOrderLines } from "@workspace/commerce/order-writes"
import { priceOrder } from "@workspace/commerce/pricing"
import { loadTradeTerms, tradeDiscount, type TradeTerms } from "@workspace/commerce/trade-accounts"
import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus, PaymentMethod, PaymentStatus, ShippingMethod } from "@workspace/db/enums"
import { clearCart, loadCart, sumInstallation } from "./cart"

// Checkout: pricing the basket with delivery to an address, and placing the order from it (unpaid, with its stock
// reserved; payment follows on Paystack). Prices come from the stores' listings, never the browser, and the order is
// refused if it would cost anything other than the total the page showed. In its own module, with relative imports,
// so it can be tested against the database without a request.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx

export type CheckoutErrorCode = "EMPTY_BASKET" | "BASKET_CHANGED" | "PRICE_CHANGED" | "NO_DELIVERY" | "NO_INSTALLATION" | "TOO_MANY_UNPAID"

const MESSAGES: Record<CheckoutErrorCode, string> = {
  EMPTY_BASKET: "Your basket is empty.",
  BASKET_CHANGED: "Something in your basket changed. Please check it before placing your order.",
  PRICE_CHANGED: "Your order's total has changed. Please check it before placing your order.",
  NO_DELIVERY: "We don't deliver to that town yet.",
  NO_INSTALLATION: "We don't install in that town yet. Take installation off in your basket, or choose another address.",
  TOO_MANY_UNPAID: "You already have orders waiting for payment. Please pay for one of them, or wait for it to lapse, before placing another.",
}

// Unpaid orders hold their stock until they're paid or cancelled, so placing them is limited: this many at a time per
// email or phone number, and per address placed from (a household or office may share one)
export const MAX_UNPAID_ORDERS = 2
export const MAX_UNPAID_ORDERS_PER_IP = 4

export class CheckoutError extends Error {
  readonly code: CheckoutErrorCode

  constructor(code: CheckoutErrorCode) {
    super(MESSAGES[code])
    this.code = code
  }
}

export interface Area {
  region: string
  town: string
}

// The basket checked again (loadCart), its lines as an order would sell them, and their prices with delivery to the
// area (or without delivery when there's no area yet). Throws CheckoutError for an empty basket, or an area with no
// delivery or, when a line includes installation, none of that; and OrderItemError when a line can't be sold. An
// approved trade account's discount (trade) comes off the goods, before tax.
export async function priceCheckout(client: Client, sessionCartId: string, pricing: PricingContext, area: Area | null, trade: TradeTerms | null) {
  const basket = await loadCart(client, sessionCartId, pricing, trade)
  if (!basket.lines.length) throw new CheckoutError("EMPTY_BASKET")

  const lines = await resolveOrderLines(
    client,
    null,
    basket.lines.map((line) => ({ listingId: line.listingId, listingVariantId: line.listingVariantId, quantity: line.quantity, installation: line.withInstallation }))
  )
  const input = { lines, exchangeRate: new Prisma.Decimal(pricing.rate.rate), discount: trade && tradeDiscount(trade), tax: pricing.tax }
  const goods = priceOrder({ ...input, shippingGhs: new Prisma.Decimal(0) })
  const discountGhs = goods.discountAmountGhs ?? new Prisma.Decimal(0)

  let quote: DeliveryQuote | null = null
  if (area) {
    quote = quoteDelivery(await loadDeliverySettings(client), area.region, area.town, goods.subtotalGhs.minus(discountGhs))
    if (!quote) throw new CheckoutError("NO_DELIVERY")
    if (lines.some((line) => line.installationUnitGhs) && !installsIn(await loadInstallationAreas(client), area.region, area.town)) throw new CheckoutError("NO_INSTALLATION")
  }
  const priced = quote ? priceOrder({ ...input, shippingGhs: quote.feeGhs }) : goods

  return {
    basket,
    lines,
    priced,
    quote,
    // What the summary shows, so the rows add up to the total: the items, installation and delivery each with their tax;
    // for a trade account, each before tax, the discount, then the tax
    summary: {
      trade: trade && { percent: trade.percent.toString() },
      itemsGhs: (trade ? goods.subtotalGhs : goods.subtotalGhs.plus(goods.lines.reduce((sum, line) => sum.plus(line.taxGhs), new Prisma.Decimal(0)))).toFixed(2),
      discountGhs: trade ? discountGhs.toFixed(2) : null,
      installationGhs: !goods.installationGhs.gt(0) ? null : trade ? goods.installationGhs.toFixed(2) : sumInstallation(goods.lines).toFixed(2),
      deliveryGhs: !quote ? null : trade ? priced.shippingGhs.toFixed(2) : priced.shippingGhs.plus(priced.taxGhs).minus(goods.taxGhs).toFixed(2),
      freeDelivery: quote?.isFree ?? false,
      taxGhs: pricing.tax ? priced.taxGhs.toFixed(2) : null,
      totalGhs: priced.totalGhs.toFixed(2),
    },
  }
}

export type CheckoutSummary = Awaited<ReturnType<typeof priceCheckout>>["summary"]

export interface PlaceOrderInput extends Area {
  name: string
  email: string
  phone: string
  line1: string
  line2: string
  notes: string
  // The total the page showed
  expectedTotalGhs: string
  // Where the order is placed from, when known
  ip: string | null
  // The signed-in customer's account, which the order is then listed under
  userId: string | null
}

const unpaidStorefrontOrder = {
  createdById: null,
  status: OrderStatus.PENDING,
  paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
} satisfies Prisma.OrderWhereInput

// Places the order from the basket and empties the basket, in the caller's transaction. Throws CheckoutError when the
// basket or the total changed since the page showed them (the page then shows them again), and OrderItemError when
// stock ran out.
export async function placeOrder(tx: Tx, sessionCartId: string, pricing: PricingContext, input: PlaceOrderInput) {
  const email = input.email.toLowerCase()
  const byCustomer = await tx.order.count({ where: { ...unpaidStorefrontOrder, OR: [{ customerEmail: email }, { customerPhone: input.phone }] } })
  const byIp = input.ip ? await tx.order.count({ where: { ...unpaidStorefrontOrder, placedFromIp: input.ip } }) : 0
  if (byCustomer >= MAX_UNPAID_ORDERS || byIp >= MAX_UNPAID_ORDERS_PER_IP) throw new CheckoutError("TOO_MANY_UNPAID")

  // The account's terms as they are now, not as the page saw them: a suspension stops the discount (PRICE_CHANGED)
  const trade = await loadTradeTerms(tx, input.userId)
  const { basket, lines, priced } = await priceCheckout(tx, sessionCartId, pricing, input, trade)
  // loadCart moved, lowered or dropped lines: the customer hasn't seen this basket
  if (basket.notices.length) throw new CheckoutError("BASKET_CHANGED")
  if (!priced.totalGhs.eq(input.expectedTotalGhs)) throw new CheckoutError("PRICE_CHANGED")

  const order = await createOrder(tx, {
    createdById: null,
    placedFromIp: input.ip,
    statusNote: "Placed on the storefront",
    customer: { userId: input.userId, name: input.name, email, phone: input.phone },
    shippingMethod: ShippingMethod.DELIVERY,
    paymentMethod: PaymentMethod.CARD,
    shipping: { name: input.name, phone: input.phone, line1: input.line1, line2: input.line2 || null, region: input.region, town: input.town },
    notes: input.notes || null,
    discount: trade && tradeDiscount(trade),
    trade: trade && { accountId: trade.accountId, companyName: trade.companyName, tin: trade.tin },
    rate: { id: pricing.rate.id, value: new Prisma.Decimal(pricing.rate.rate) },
    lines,
    priced,
  })
  await clearCart(tx, sessionCartId)
  return order
}
