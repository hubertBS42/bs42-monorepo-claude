import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { authURLs } from "@workspace/auth/constants"

// Who can see a storefront order without an account: whoever has its link (the storefront's /orders/[reference]). The link carries a key signed with the
// auth secret, so an order can't be opened by guessing its reference.

function sign(orderId: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required")
  return createHmac("sha256", secret).update(`order:${orderId}`).digest("base64url").slice(0, 32)
}

export function orderKey(orderId: string) {
  return sign(orderId)
}

export function isOrderKey(orderId: string, key: string | undefined) {
  if (!key) return false
  const expected = sign(orderId)
  return key.length === expected.length && timingSafeEqual(Buffer.from(key), Buffer.from(expected))
}

export function orderHref(reference: string, orderId: string) {
  return `/orders/${reference}?key=${orderKey(orderId)}`
}

// The order page's full address, for emails
export function orderUrl(reference: string, orderId: string) {
  return new URL(orderHref(reference, orderId), authURLs.store).toString()
}
