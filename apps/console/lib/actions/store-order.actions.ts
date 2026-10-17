"use server"

import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { hasStorePermission, requireConsoleAccess } from "@/lib/auth-guard"
import { isPaid, nextOrderStatuses } from "@/lib/order-status"
import { recordStorePaymentSchema, updateStoreOrderStatusSchema } from "@/lib/schemas/order.schemas"

// Every export here is a public endpoint, so every input is validated, and each one calls requireConsoleAccess
// before its try block (its redirect throws, which the catch would swallow). A store manages only orders made up
// entirely of its own items; an order spanning stores is the platform's (the global orders pages).

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const FORBIDDEN: ActionResponse = { success: false, error: "Your role in this store can't manage orders.", code: "FORBIDDEN" }
const NOT_FOUND: ActionResponse = { success: false, error: "Order not found.", code: "NOT_FOUND" }
const MULTI_STORE: ActionResponse = { success: false, error: "This order has items from other stores, so the platform manages it.", code: "MULTI_STORE" }
const STATUS_CHANGED: ActionResponse = { success: false, error: "This order's status was changed by someone else. Refresh the page to see it.", code: "STATUS_CHANGED" }

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

class StatusChangedError extends Error {}

// The order with what the actions need, or a response when the store can't manage it
async function loadManageableOrder(orderId: string, storeId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, orderItems: { some: { organizationId: storeId } } },
    select: {
      status: true,
      paymentStatus: true,
      shippingMethod: true,
      orderItems: {
        select: {
          organizationId: true,
          quantity: true,
          storeListingId: true,
          storeListingVariantId: true,
          storeListing: { select: { trackInventory: true } },
          storeListingVariant: { select: { trackInventory: true } },
        },
      },
    },
  })
  if (!order) return { problem: NOT_FOUND }
  if (order.orderItems.some((item) => item.organizationId !== storeId)) return { problem: MULTI_STORE }
  return { order }
}

export async function updateStoreOrderStatusAction(input: z.input<typeof updateStoreOrderStatusSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = updateStoreOrderStatusSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, orderId, status, currentStatus, note } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { order: ["update"] }))) return FORBIDDEN

    const { order, problem } = await loadManageableOrder(orderId, storeId)
    if (problem) return problem
    if (order.status !== currentStatus) return STATUS_CHANGED

    if (!nextOrderStatuses(currentStatus, order.shippingMethod).includes(status)) {
      return { success: false, error: "The order can't move to that status from where it is.", code: "INVALID_TRANSITION" }
    }
    if (status === OrderStatus.CANCELLED && isPaid(order.paymentStatus)) {
      return { success: false, error: "This order has been paid, so cancelling it needs a refund. Ask the platform to cancel and refund it.", code: "PAID_ORDER" }
    }
    if (status === OrderStatus.COMPLETED && order.paymentStatus !== PaymentStatus.PAID) {
      return { success: false, error: "Record the payment before completing the order.", code: "UNPAID" }
    }

    await prisma.$transaction(async (tx) => {
      // Only from the status the page showed, so two people can't both move it on, and never cancelling an order
      // that was paid in the meantime
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: currentStatus, ...(status === OrderStatus.CANCELLED && { paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } }) },
        data: { status },
      })
      if (count === 0) throw new StatusChangedError()

      await tx.orderStatusHistory.create({ data: { orderId, status, note: note || null, changedById: session.user.id } })

      // Stock was reserved when the order was made, for the rows that track it, so a cancellation puts it back
      if (status === OrderStatus.CANCELLED) {
        for (const item of order.orderItems) {
          if (item.storeListingVariantId) {
            if (item.storeListingVariant?.trackInventory) {
              await tx.storeListingVariant.update({ where: { id: item.storeListingVariantId }, data: { stock: { increment: item.quantity } } })
            }
          } else if (item.storeListing.trackInventory) {
            await tx.storeListing.update({ where: { id: item.storeListingId }, data: { stock: { increment: item.quantity } } })
          }
        }
      }
    }, TRANSACTION_OPTIONS)

    return { success: true }
  } catch (error) {
    if (error instanceof StatusChangedError) return STATUS_CHANGED
    return { success: false, error: formatError(error) }
  }
}

// For orders paid in the store: cash at the counter, mobile money or a card terminal
export async function recordStorePaymentAction(input: z.input<typeof recordStorePaymentSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = recordStorePaymentSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, orderId, paymentMethod } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { order: ["update"] }))) return FORBIDDEN

    const { order, problem } = await loadManageableOrder(orderId, storeId)
    if (problem) return problem
    if (order.status === OrderStatus.CANCELLED) return { success: false, error: "This order was cancelled, so it can't be paid.", code: "CANCELLED" }

    // Only an unpaid order, so a payment can't be recorded twice
    const { count } = await prisma.order.updateMany({
      where: { id: orderId, paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] }, status: { not: OrderStatus.CANCELLED } },
      data: { paymentStatus: PaymentStatus.PAID, paymentMethod, paidAt: new Date(), paymentRecordedById: session.user.id },
    })
    if (count === 0) return { success: false, error: "This order's payment was already recorded, or it was cancelled. Refresh the page.", code: "PAYMENT_CHANGED" }

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
