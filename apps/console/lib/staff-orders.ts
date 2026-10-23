import "server-only"

import type { PricingContext } from "@workspace/commerce/exchange-rates"
import { createOrder } from "@workspace/commerce/order-writes"
import { loadTradeTerms } from "@workspace/commerce/trade-accounts"
import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { ShippingMethod, type PaymentMethod } from "@workspace/db/enums"
import { priceStaffSale, StaffQuoteError, type StaffSalePricingInput } from "./staff-quotes"

// Orders the platform's staff make for a customer (/orders/create): items from any store, each at the offer the
// storefront would sell, with installation where it's offered, priced and checked as a staff quotation is
// (staff-quotes.ts). In its own module, with relative imports, so it can be tested against the database.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface NewStaffOrder extends StaffSalePricingInput {
  // The customer's account, when staff found them by email or phone
  customerUserId: string | null
  name: string
  // Optional: without an email the customer gets no emails about the order
  email: string | null
  phone: string | null
  // Who receives the delivery
  recipientName: string
  recipientPhone: string
  line1: string
  line2: string
  // How the customer means to pay; staff record the payment once it arrives
  paymentMethod: PaymentMethod
  // For staff, not the customer
  notes: string
  // The total staff saw (and may have told the customer)
  expectedTotalGhs: Prisma.Decimal
}

// Creates the order, unpaid and with its stock reserved, in the caller's transaction. An approved trade account's
// company and TIN go on it as on the customer's own orders; its discount is whatever staff set (the form starts from
// the account's). Throws StaffQuoteError (PRICE_CHANGED when it no longer comes to the total staff saw), or
// OrderItemError for a line that can't be sold or is out of stock.
export async function createStaffOrder(tx: Tx, pricing: PricingContext, input: NewStaffOrder, staffId: string) {
  if (input.customerUserId && !(await tx.user.findUnique({ where: { id: input.customerUserId }, select: { id: true } }))) throw new StaffQuoteError("CUSTOMER_NOT_FOUND")
  const trade = await loadTradeTerms(tx, input.customerUserId)
  const { lines, priced } = await priceStaffSale(tx, pricing, input)
  // A new day's rate, a store's new price or a change to tax since the review step
  if (!priced.totalGhs.equals(input.expectedTotalGhs)) throw new StaffQuoteError("PRICE_CHANGED")

  return createOrder(tx, {
    createdById: staffId,
    statusNote: "Created by the platform",
    customer: { userId: input.customerUserId, name: input.name, email: input.email?.toLowerCase() || null, phone: input.phone || null },
    shippingMethod: ShippingMethod.DELIVERY,
    paymentMethod: input.paymentMethod,
    shipping: { name: input.recipientName, phone: input.recipientPhone, line1: input.line1, line2: input.line2 || null, region: input.region, town: input.town },
    notes: input.notes || null,
    discount: input.discount,
    trade: trade && { accountId: trade.accountId, companyName: trade.companyName, tin: trade.tin },
    rate: { id: pricing.rate.id, value: new Prisma.Decimal(pricing.rate.rate) },
    lines,
    priced,
  })
}
