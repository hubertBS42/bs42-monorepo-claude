"use server"

import { after } from "next/server"
import { formatError } from "@workspace/auth/format-error"
import { getPricingContext } from "@workspace/commerce/exchange-rates"
import { notifyNewQuote, notifyStockAlerts } from "@workspace/commerce/notifications"
import { quoteHref, quoteUrl } from "@workspace/commerce/order-links"
import { OrderItemError } from "@workspace/commerce/order-writes"
import type { DataResponse } from "@workspace/contracts"
import { prisma, readAppSettings, resolveStoreName } from "@workspace/db"
import { QuoteEmail, sendEmail } from "@workspace/email"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import { z } from "zod"

import { readCartId } from "@/lib/cart-cookie"
import { CheckoutError } from "@/lib/checkout"
import { paymentRedirect, visitorIp } from "@/lib/payments"
import { acceptQuote, cancelQuote, createQuote, QuoteError } from "@/lib/quotes"
import { quoteRequestSchema, type QuoteRequestValues } from "@/lib/schemas/quote.schemas"
import { getStoreSession, getTradeTerms } from "@/lib/session"

// Quotations' actions: making one from the basket, cancelling one, and accepting one (which places the order and
// sends the customer to pay). All need the quote's owner signed in; the quote's link only shows it.

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

const SIGNED_OUT = { success: false as const, error: "Sign in to make or accept a quotation.", code: "UNAUTHORIZED" }
const NO_RATE = { success: false as const, error: "We're updating our prices. Please try again in a little while.", code: "NO_RATE" }

function failure(error: unknown) {
  if (error instanceof QuoteError || error instanceof CheckoutError || error instanceof OrderItemError) return { success: false as const, error: error.message, code: error.code }
  console.error("A quotation action failed:", error)
  return { success: false as const, error: formatError(error) }
}

// The customer's copy, in the storefront's name, with the link to forward. Never throws: it runs after the response.
async function sendQuoteEmail(quoteId: string) {
  try {
    const [quote, settings] = await Promise.all([
      prisma.quote.findUnique({ where: { id: quoteId }, select: { reference: true, customerName: true, customerEmail: true, totalGhs: true, validUntil: true } }),
      readAppSettings(),
    ])
    if (!quote) return
    const appName = resolveStoreName(settings)
    await sendEmail({
      to: quote.customerEmail,
      fromName: appName,
      subject: `Your quotation ${quote.reference}`,
      reactTemplate: QuoteEmail({
        name: quote.customerName.split(" ")[0] || quote.customerName,
        reference: quote.reference,
        total: formatCurrency(quote.totalGhs.toFixed(2), "GHS", "en-GH"),
        // validUntil is the start of the day after the last one
        validUntil: formatDate(new Date(quote.validUntil.getTime() - 1), "EEEE d MMMM"),
        url: quoteUrl(quote.reference, quoteId),
        appName,
        logoUrl: settings.logoUrl,
      }),
    })
  } catch (error) {
    console.error(`Could not send the quotation email for ${quoteId}:`, error)
  }
}

// "Get a quote" in the basket: the quote's page to go to
export async function createQuoteAction(input: QuoteRequestValues): Promise<DataResponse<{ redirectTo: string }>> {
  try {
    const session = await getStoreSession()
    if (!session) return SIGNED_OUT
    const parsed = quoteRequestSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the details.", code: "INVALID_INPUT" }

    const [cartId, pricing, trade, settings] = await Promise.all([readCartId(), getPricingContext(), getTradeTerms(), readAppSettings()])
    if (!cartId) return { success: false, error: "Your basket is empty.", code: "EMPTY_BASKET" }
    if (!pricing) return NO_RATE

    const quote = await prisma.$transaction(
      (tx) => createQuote(tx, cartId, pricing, { ...parsed.data, userId: session.user.id, email: session.user.email, validityDays: settings.quoteValidityDays, trade }),
      TRANSACTION_OPTIONS
    )
    after(async () => {
      await sendQuoteEmail(quote.id)
      await notifyNewQuote(quote.id)
    })
    return { success: true, data: { redirectTo: quoteHref(quote.reference, quote.id) } }
  } catch (error) {
    return failure(error)
  }
}

export async function cancelQuoteAction(quoteId: string): Promise<DataResponse<null>> {
  try {
    const session = await getStoreSession()
    if (!session) return SIGNED_OUT
    if (!z.uuid().safeParse(quoteId).success) return { success: false, error: "We can't find that quotation.", code: "NOT_FOUND" }

    await cancelQuote(prisma, session.user.id, quoteId)
    return { success: true, data: null }
  } catch (error) {
    return failure(error)
  }
}

// "Accept and pay": places the order at the quote's prices and sends the customer to Paystack, as checkout does
export async function acceptQuoteAction(quoteId: string): Promise<DataResponse<{ redirectTo: string }>> {
  try {
    const session = await getStoreSession()
    if (!session) return SIGNED_OUT
    if (!z.uuid().safeParse(quoteId).success) return { success: false, error: "We can't find that quotation.", code: "NOT_FOUND" }

    const ip = await visitorIp()
    const { stockAlerts, ...order } = await prisma.$transaction((tx) => acceptQuote(tx, quoteId, session.user.id, ip), TRANSACTION_OPTIONS)
    // Stock went down now; the customer's and staff's order emails wait for the payment, as checkout's do
    after(() => notifyStockAlerts(stockAlerts))
    return { success: true, data: { redirectTo: await paymentRedirect(order) } }
  } catch (error) {
    return failure(error)
  }
}
