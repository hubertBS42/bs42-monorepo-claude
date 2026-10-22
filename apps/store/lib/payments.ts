import "server-only"

import { headers } from "next/headers"
import { authURLs } from "@workspace/auth/constants"
import { createPaymentAttempt, markAttemptFailed } from "@workspace/commerce/online-payments"
import { orderHref } from "@workspace/commerce/order-links"
import { initializeTransaction } from "@workspace/commerce/paystack"
import { prisma } from "@workspace/db"

// Paying for a storefront order on Paystack, for the actions that place one (checkout, accepting a quote) and the
// order page's "Pay now"

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

// The first address in X-Forwarded-For is the visitor's, as the host's proxy adds it
export async function visitorIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null
}

// Starts paying for an order on Paystack: a new attempt, and the page on Paystack to send the customer to
export async function startPayment(orderId: string) {
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

// Where to send the customer once an order is placed: Paystack's checkout, or the order's page if Paystack couldn't be
// reached (the order stands; its page offers to try paying again)
export async function paymentRedirect(order: { id: string; reference: string }) {
  try {
    return await startPayment(order.id)
  } catch (error) {
    console.error(`Couldn't start paying for ${order.reference}:`, error)
    return `${orderHref(order.reference, order.id)}&payment=unavailable`
  }
}
