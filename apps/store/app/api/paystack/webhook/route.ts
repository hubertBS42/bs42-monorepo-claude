import { after } from "next/server"
import { sendPaymentEmails, settlePaystackTransaction } from "@workspace/commerce/online-payments"
import { isPaystackSignature, type PaystackTransaction } from "@workspace/commerce/paystack"

// Paystack's webhook (set its URL in the Paystack dashboard to https://<store>/api/paystack/webhook). Only signed
// requests count; charge.success records the payment, once, however often Paystack sends it. Anything else is
// acknowledged and ignored. An error answers 500, so Paystack sends it again later.
export async function POST(request: Request) {
  const body = await request.text()
  if (!isPaystackSignature(body, request.headers.get("x-paystack-signature"))) return new Response("Invalid signature", { status: 401 })

  const event = JSON.parse(body) as { event?: string; data?: PaystackTransaction }
  if (event.event !== "charge.success" || !event.data?.reference) return new Response(null, { status: 200 })

  const outcome = await settlePaystackTransaction(event.data)
  after(() => sendPaymentEmails(outcome))
  return new Response(null, { status: 200 })
}
