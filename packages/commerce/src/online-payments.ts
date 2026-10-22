import "server-only"

import { randomBytes } from "node:crypto"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus, PaymentAttemptStatus, PaymentMethod, PaymentStatus } from "@workspace/db/enums"
import { notifyNewOrder, notifyPaymentProblem, type PaymentProblem } from "./notifications"
import { sendOrderEmail } from "./order-emails"
import { orderUrl } from "./order-links"
import { changeOrderStatus, StatusChangedError } from "./order-writes"
import { verifyTransaction, type PaystackTransaction } from "./paystack"

// Paying storefront orders online, through Paystack (paystack.ts). An order is placed unpaid, with its stock reserved;
// the customer can start paying for PAYMENT_WINDOW_MINUTES, and an order still unpaid after UNPAID_CANCEL_MINUTES is
// cancelled (cancelUnpaidOrders), which puts its stock back. A payment is recorded from whichever comes first: the
// customer's return from Paystack, Paystack's webhook, or the cancelling job asking Paystack. Each records it once.
// The writes take a transaction so they can be tested against the database without Paystack.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

export const PAYMENT_WINDOW_MINUTES = 30
// Later than the window, so a payment started in its last minute has time to finish before the order goes
export const UNPAID_CANCEL_MINUTES = 45

const minutesAfter = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000)

export const paymentDeadline = (createdAt: Date) => minutesAfter(createdAt, PAYMENT_WINDOW_MINUTES)

export interface PayableOrder {
  status: OrderStatus
  paymentStatus: PaymentStatus
  // Null for an order placed on the storefront: staff orders are paid in person
  createdById: string | null
  createdAt: Date
}

// Whether the customer can (still) start paying for an order online
export function canStartPayment(order: PayableOrder, now = new Date()) {
  return (
    order.createdById === null &&
    order.status === OrderStatus.PENDING &&
    (order.paymentStatus === PaymentStatus.PENDING || order.paymentStatus === PaymentStatus.FAILED) &&
    now < paymentDeadline(order.createdAt)
  )
}

export class PaymentClosedError extends Error {}

// A new attempt at paying an order, for Paystack's checkout. Throws PaymentClosedError when the order can't be paid
// online any more (paid, cancelled, or the window has passed).
export async function createPaymentAttempt(tx: Tx, orderId: string) {
  await lockOrder(tx, orderId)
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { reference: true, status: true, paymentStatus: true, createdById: true, createdAt: true, totalGhs: true, customerEmail: true },
  })
  if (!order || !order.customerEmail || !canStartPayment(order)) throw new PaymentClosedError()

  // Paystack takes each reference once; the suffix makes a new one per attempt and can't be guessed
  const reference = `${order.reference}-${randomBytes(4).toString("hex").toUpperCase()}`
  await tx.paymentAttempt.create({ data: { orderId, reference, amountGhs: order.totalGhs } })
  return { reference, amountGhs: order.totalGhs, email: order.customerEmail, orderReference: order.reference }
}

// An attempt Paystack refused to start
export async function markAttemptFailed(client: Client, reference: string, message: string) {
  await client.paymentAttempt.updateMany({ where: { reference, status: PaymentAttemptStatus.PENDING }, data: { status: PaymentAttemptStatus.FAILED, gatewayResponse: message } })
}

// Holds the order's row until the transaction ends, so a payment, a new attempt and the cancelling job take turns.
// Raw SQL: Prisma has no SELECT … FOR UPDATE.
async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM "order" WHERE id = ${orderId}::uuid FOR UPDATE`
}

export type PaymentOutcome =
  | { kind: "PAID"; orderId: string }
  // This attempt's success was recorded before (the webhook and the customer's return both report it)
  | { kind: "ALREADY_RECORDED"; orderId: string }
  // Failed, abandoned, or still going
  | { kind: "NOT_PAID"; orderId: string; status: string }
  | { kind: "UNKNOWN_REFERENCE" }
  // Money came in that the order can't simply take: staff are emailed to sort it out
  | { kind: "PROBLEM"; orderId: string; problem: PaymentProblem; reference: string; amountGhs: string }

const FINISHED_UNPAID: Record<string, PaymentAttemptStatus> = { failed: PaymentAttemptStatus.FAILED, reversed: PaymentAttemptStatus.FAILED, abandoned: PaymentAttemptStatus.ABANDONED }

// Records what Paystack says about an attempt. A success pays the order, unless the order was cancelled meanwhile
// (the payment is still recorded on it, so staff can refund it), was already paid by another attempt, or the amount
// isn't the order's total: those are PROBLEMs for staff.
export async function recordPaystackTransaction(tx: Tx, transaction: PaystackTransaction): Promise<PaymentOutcome> {
  const attempt = await tx.paymentAttempt.findUnique({ where: { reference: transaction.reference }, select: { id: true, orderId: true, status: true } })
  if (!attempt) return { kind: "UNKNOWN_REFERENCE" }
  const { orderId } = attempt

  await lockOrder(tx, orderId)
  // Read again under the lock: another request may have just recorded it
  const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id }, select: { status: true } })
  if (current.status === PaymentAttemptStatus.SUCCESS) return { kind: "ALREADY_RECORDED", orderId }

  if (transaction.status !== "success") {
    const finished = FINISHED_UNPAID[transaction.status]
    if (finished) {
      await tx.paymentAttempt.updateMany({ where: { id: attempt.id, status: PaymentAttemptStatus.PENDING }, data: { status: finished, gatewayResponse: transaction.gateway_response } })
    }
    return { kind: "NOT_PAID", orderId, status: transaction.status }
  }

  const paidAt = transaction.paid_at ? new Date(transaction.paid_at) : new Date()
  await tx.paymentAttempt.update({
    where: { id: attempt.id },
    data: { status: PaymentAttemptStatus.SUCCESS, channel: transaction.channel, gatewayResponse: transaction.gateway_response, paidAt },
  })

  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, paymentStatus: true, totalGhs: true } })
  const amountGhs = new Prisma.Decimal(transaction.amount).dividedBy(100)
  const problem = (kind: PaymentProblem): PaymentOutcome => ({ kind: "PROBLEM", orderId, problem: kind, reference: transaction.reference, amountGhs: amountGhs.toFixed(2) })

  if (transaction.currency !== "GHS" || !amountGhs.eq(order.totalGhs)) return problem("AMOUNT_MISMATCH")
  const unpaid = order.paymentStatus === PaymentStatus.PENDING || order.paymentStatus === PaymentStatus.FAILED
  if (!unpaid) return problem("PAID_TWICE")

  await tx.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paidAt,
      paymentMethod: transaction.channel === "mobile_money" ? PaymentMethod.MOBILE_MONEY : PaymentMethod.CARD,
      paymentRecordedById: null,
    },
  })
  // Recorded on the order all the same, so the console can refund it
  return order.status === OrderStatus.CANCELLED ? problem("ORDER_CANCELLED") : { kind: "PAID", orderId }
}

// Asks Paystack how an attempt went and records it. Throws PaystackError when Paystack can't be reached.
export async function settlePaystackReference(reference: string) {
  const transaction = await verifyTransaction(reference)
  return prisma.$transaction((tx) => recordPaystackTransaction(tx, transaction), TRANSACTION_OPTIONS)
}

export async function settlePaystackTransaction(transaction: PaystackTransaction) {
  return prisma.$transaction((tx) => recordPaystackTransaction(tx, transaction), TRANSACTION_OPTIONS)
}

// The emails a recorded payment sends, once its transaction has committed: the customer's order confirmation and the
// staff's new-order email (an online order is only news once it's paid), or the staff's problem email. Never throws.
export async function sendPaymentEmails(outcome: PaymentOutcome) {
  if (outcome.kind === "PAID") {
    await sendOrderEmail(outcome.orderId, "CREATED")
    await notifyNewOrder(outcome.orderId, "storefront")
  } else if (outcome.kind === "PROBLEM") {
    await notifyPaymentProblem(outcome.orderId, outcome.problem, outcome.reference, outcome.amountGhs)
  }
}

// Storefront orders still unpaid once the customer's time is up, oldest first
export async function findUnpaidOrders(client: Client, now = new Date()) {
  return client.order.findMany({
    where: {
      createdById: null,
      status: OrderStatus.PENDING,
      paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
      createdAt: { lt: minutesAfter(now, -UNPAID_CANCEL_MINUTES) },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, reference: true, paymentAttempts: { where: { status: PaymentAttemptStatus.PENDING }, select: { reference: true } } },
  })
}

// Cancels an unpaid order and puts its stock back. False when it was paid or changed meanwhile.
export async function cancelUnpaidOrder(tx: Tx, orderId: string) {
  await lockOrder(tx, orderId)
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      paymentStatus: true,
      orderItems: {
        select: {
          quantity: true,
          storeListingId: true,
          storeListingVariantId: true,
          tracksStock: true,
        },
      },
    },
  })
  if (!order || order.status !== OrderStatus.PENDING || !(order.paymentStatus === PaymentStatus.PENDING || order.paymentStatus === PaymentStatus.FAILED)) return false

  try {
    await changeOrderStatus(tx, {
      orderId,
      from: OrderStatus.PENDING,
      to: OrderStatus.CANCELLED,
      note: `Not paid within ${PAYMENT_WINDOW_MINUTES} minutes`,
      changedById: null,
      items: order.orderItems,
    })
  } catch (error) {
    if (error instanceof StatusChangedError) return false
    throw error
  }
  // Attempts never finished are over now: a payment that still comes in is recorded as a problem for staff
  await tx.paymentAttempt.updateMany({ where: { orderId, status: PaymentAttemptStatus.PENDING }, data: { status: PaymentAttemptStatus.ABANDONED } })
  return true
}

export interface UnpaidOrdersResult {
  cancelled: string[]
  paid: string[]
  // Paystack couldn't say how an attempt went: left for the next run
  skipped: string[]
}

// The cancelling job (the console's /api/cron/unpaid-orders). Each order's open attempts are checked with Paystack
// first, so an order paid at the last moment is recorded as paid, not cancelled.
export async function cancelUnpaidOrders(): Promise<UnpaidOrdersResult> {
  const result: UnpaidOrdersResult = { cancelled: [], paid: [], skipped: [] }

  for (const order of await findUnpaidOrders(prisma)) {
    let paid = false
    let unknown = false
    for (const attempt of order.paymentAttempts) {
      try {
        const outcome = await settlePaystackReference(attempt.reference)
        await sendPaymentEmails(outcome)
        if (outcome.kind === "PAID" || outcome.kind === "PROBLEM") paid = true
      } catch (error) {
        console.error(`Couldn't check payment ${attempt.reference} with Paystack:`, error)
        unknown = true
      }
    }
    if (paid) result.paid.push(order.reference)
    else if (unknown) result.skipped.push(order.reference)
    else if (await prisma.$transaction((tx) => cancelUnpaidOrder(tx, order.id), TRANSACTION_OPTIONS)) {
      result.cancelled.push(order.reference)
      // Its link offers to put the items back in the basket
      await sendOrderEmail(order.id, "UNPAID_CANCELLED", null, { orderUrl: orderUrl(order.reference, order.id), paymentMinutes: PAYMENT_WINDOW_MINUTES })
    }
  }
  return result
}
