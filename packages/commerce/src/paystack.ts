import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

// Paystack's API, as the storefront uses it: start a payment on Paystack's own checkout page (mobile money and cards, in
// GHS), ask how a payment went, and check that a webhook came from Paystack. Amounts go to Paystack in pesewas.
// https://paystack.com/docs/api/transaction/

const API = "https://api.paystack.co"

export class PaystackError extends Error {}

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new PaystackError("Online payments aren't set up (PAYSTACK_SECRET_KEY).")
  return key
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  const body = (await response.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null
  if (!response.ok || !body?.status || body.data === undefined) throw new PaystackError(body?.message ?? `Paystack answered ${response.status}.`)
  return body.data
}

// GHS 12.34 → 1234 pesewas. Amounts are stored to the cent, so this is exact.
export function toPesewas(amountGhs: { toFixed(places: number): string }) {
  return Number(amountGhs.toFixed(2).replace(".", ""))
}

export interface StartPayment {
  reference: string
  email: string
  amountGhs: { toFixed(places: number): string }
  // Where Paystack sends the customer back to, with ?reference= added
  callbackUrl: string
  metadata: Record<string, string>
}

// Returns the page on Paystack the customer pays on
export async function initializeTransaction(payment: StartPayment) {
  const data = await call<{ authorization_url: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      reference: payment.reference,
      email: payment.email,
      amount: toPesewas(payment.amountGhs),
      currency: "GHS",
      channels: ["mobile_money", "card"],
      callback_url: payment.callbackUrl,
      metadata: payment.metadata,
    }),
  })
  return data.authorization_url
}

// How a payment went, as Paystack's verify endpoint and its charge.success webhook both describe it
export interface PaystackTransaction {
  reference: string
  // success, failed, abandoned, ongoing, pending, processing, queued, reversed
  status: string
  // In pesewas
  amount: number
  currency: string
  channel: string | null
  gateway_response: string | null
  paid_at: string | null
}

export async function verifyTransaction(reference: string) {
  return call<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`)
}

// A webhook is Paystack's when its x-paystack-signature is the HMAC-SHA512 of the raw body with our secret key
export function isPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex")
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
