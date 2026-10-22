"use server"

import { headers } from "next/headers"
import { after } from "next/server"
import { authURLs } from "@workspace/auth/constants"
import { formatError } from "@workspace/auth/format-error"
import { getPricingContext } from "@workspace/commerce/exchange-rates"
import { notifyStockAlerts } from "@workspace/commerce/notifications"
import { createPaymentAttempt, markAttemptFailed, PaymentClosedError } from "@workspace/commerce/online-payments"
import { OrderItemError } from "@workspace/commerce/order-writes"
import { initializeTransaction } from "@workspace/commerce/paystack"
import type { DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { isOrderKey, orderHref } from "@workspace/commerce/order-links"

import { rememberAddress } from "@/lib/addresses"
import { readCartId } from "@/lib/cart-cookie"
import { CheckoutError, placeOrder, priceCheckout, type CheckoutSummary } from "@/lib/checkout"
import { areaSchema, placeOrderSchema } from "@/lib/schemas/checkout.schemas"
import { getStoreSession, getTradeTerms } from "@/lib/session"

// Checkout's actions. Anyone can call them: the basket cookie is the key to a basket, and the order link's key to an
// order (@workspace/commerce/order-links).

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

const NO_RATE = { success: false as const, error: "We're updating our prices. Please try again in a little while.", code: "NO_RATE" }
const EMPTY_BASKET = { success: false as const, error: "Your basket is empty.", code: "EMPTY_BASKET" }

function failure(error: unknown) {
  if (error instanceof CheckoutError || error instanceof OrderItemError) return { success: false as const, error: error.message, code: error.code }
  return { success: false as const, error: formatError(error) }
}

// The summary for delivery to an area, as the page shows it while the customer fills the address in
export async function quoteCheckoutAction(area: { region: string; town: string }): Promise<DataResponse<CheckoutSummary>> {
  try {
    const parsed = areaSchema.safeParse(area)
    if (!parsed.success) return { success: false, error: "Choose a region and town.", code: "INVALID_INPUT" }

    const [cartId, pricing, trade] = await Promise.all([readCartId(), getPricingContext(), getTradeTerms()])
    if (!cartId) return EMPTY_BASKET
    if (!pricing) return NO_RATE
    const { basket, summary } = await priceCheckout(prisma, cartId, pricing, parsed.data, trade)
    // The basket was changed to match the stores (and saved so): the page's lines are out of date
    if (basket.notices.length) return { success: false, error: basket.notices.join(" "), code: "BASKET_CHANGED" }
    return { success: true, data: summary }
  } catch (error) {
    return failure(error)
  }
}

// Starts paying for an order on Paystack: a new attempt, and the page on Paystack to send the customer to
async function startPayment(orderId: string) {
  const attempt = await prisma.$transaction((tx) => createPaymentAttempt(tx, orderId), TRANSACTION_OPTIONS)
  try {
    return await initializeTransaction({
      reference: attempt.reference,
      email: attempt.email,
      amountGhs: attempt.amountGhs,
      callbackUrl: new URL("/api/paystack/callback", authURLs.store).toString(),
      metadata: { orderId, orderReference: attempt.orderReference },
    })
  } catch (error) {
    await markAttemptFailed(prisma, attempt.reference, error instanceof Error ? error.message : String(error))
    throw error
  }
}

// Places the order and sends the customer to Paystack to pay. The order stands even if Paystack can't be reached: its
// page then offers to try paying again.
export async function placeOrderAction(input: unknown): Promise<DataResponse<{ redirectTo: string }>> {
  try {
    const parsed = placeOrderSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check your details.", code: "INVALID_INPUT" }

    const [cartId, pricing, session] = await Promise.all([readCartId(), getPricingContext(), getStoreSession()])
    if (!cartId) return EMPTY_BASKET
    if (!pricing) return NO_RATE

    // The first address in X-Forwarded-For is the visitor's, as the host's proxy adds it
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null
    const { stockAlerts, ...order } = await prisma.$transaction((tx) => placeOrder(tx, cartId, pricing, { ...parsed.data, ip, userId: session?.user.id ?? null }), TRANSACTION_OPTIONS)
    // Stock went down now, not when the order is paid. The customer's and staff's order emails wait for the payment.
    after(() => notifyStockAlerts(stockAlerts))
    // "Save this address": once the order stands, and never in its way
    if (session && parsed.data.saveAddress) {
      const { name, phone, line1, line2, region, town } = parsed.data
      after(() => rememberAddress(session.user.id, { name, phone, line1, line2, region, town }))
    }

    const orderPage = orderHref(order.reference, order.id)
    try {
      return { success: true, data: { redirectTo: await startPayment(order.id) } }
    } catch (error) {
      console.error(`Couldn't start paying for ${order.reference}:`, error)
      return { success: true, data: { redirectTo: `${orderPage}&payment=unavailable` } }
    }
  } catch (error) {
    return failure(error)
  }
}

// "Pay now" on an unpaid order's page
export async function payOrderAction(orderId: string, key: string): Promise<DataResponse<{ redirectTo: string }>> {
  try {
    if (!isOrderKey(orderId, key)) return { success: false, error: "We can't find that order.", code: "NOT_FOUND" }
    return { success: true, data: { redirectTo: await startPayment(orderId) } }
  } catch (error) {
    if (error instanceof PaymentClosedError) return { success: false, error: "This order can't be paid for any more.", code: "PAYMENT_CLOSED" }
    console.error(`Couldn't start paying for order ${orderId}:`, error)
    return { success: false, error: "We couldn't reach our payment provider. Please try again in a moment.", code: "PAYMENT_UNAVAILABLE" }
  }
}
