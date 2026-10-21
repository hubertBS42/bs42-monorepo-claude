import { after } from "next/server"
import { authURLs } from "@workspace/auth/constants"
import { sendPaymentEmails, settlePaystackReference } from "@workspace/commerce/online-payments"
import { prisma } from "@workspace/db"
import { orderHref } from "@workspace/commerce/order-links"

// Where Paystack sends the customer back to (?reference=). The payment is recorded from Paystack's own answer, not
// from the address, so a forged return changes nothing; the webhook records it too, whichever is first.
export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference")
  const attempt = reference ? await prisma.paymentAttempt.findUnique({ where: { reference }, select: { order: { select: { id: true, reference: true } } } }) : null
  if (!reference || !attempt) return Response.redirect(new URL("/", authURLs.store), 303)

  try {
    const outcome = await settlePaystackReference(reference)
    after(() => sendPaymentEmails(outcome))
  } catch (error) {
    // The webhook or the unpaid-order job will record it; the order page says it's still waiting
    console.error(`Couldn't check payment ${reference} with Paystack:`, error)
  }
  return Response.redirect(new URL(orderHref(attempt.order.reference, attempt.order.id), authURLs.store), 303)
}
