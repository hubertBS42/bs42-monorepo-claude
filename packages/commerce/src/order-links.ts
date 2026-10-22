import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { authURLs } from "@workspace/auth/constants"

// Who can see a storefront order or quotation without an account: whoever has its link (the storefront's
// /orders/[reference] and /quotes/[reference]). The link carries a key signed with the auth secret, so neither can be
// opened by guessing its reference. Orders and quotes are signed apart, so one's key never opens the other.

function sign(kind: "order" | "quote", id: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required")
  return createHmac("sha256", secret).update(`${kind}:${id}`).digest("base64url").slice(0, 32)
}

function isKey(kind: "order" | "quote", id: string, key: string | undefined) {
  if (!key) return false
  const expected = sign(kind, id)
  return key.length === expected.length && timingSafeEqual(Buffer.from(key), Buffer.from(expected))
}

export function orderKey(orderId: string) {
  return sign("order", orderId)
}

export function isOrderKey(orderId: string, key: string | undefined) {
  return isKey("order", orderId, key)
}

export const isQuoteKey = (quoteId: string, key: string | undefined) => isKey("quote", quoteId, key)

// A quotation's page, shareable with whoever approves the purchase
export function quoteHref(reference: string, quoteId: string) {
  return `/quotes/${reference}?key=${sign("quote", quoteId)}`
}

export function quoteUrl(reference: string, quoteId: string) {
  return new URL(quoteHref(reference, quoteId), authURLs.store).toString()
}

export function orderHref(reference: string, orderId: string) {
  return `/orders/${reference}?key=${orderKey(orderId)}`
}

// The order's printable invoice, behind the same key
export function invoiceHref(reference: string, orderId: string) {
  return `/orders/${reference}/invoice?key=${orderKey(orderId)}`
}

// The invoice's full address, for the console's order pages
export function invoiceUrl(reference: string, orderId: string) {
  return new URL(invoiceHref(reference, orderId), authURLs.store).toString()
}

// The order page's full address, for emails
export function orderUrl(reference: string, orderId: string) {
  return new URL(orderHref(reference, orderId), authURLs.store).toString()
}
