"use server"

import { after } from "next/server"
import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { ShippingMethod } from "@workspace/db/enums"
import { requireSystemPermission } from "@/lib/auth-guard"
import { sendOrderEmail } from "@/lib/order-emails"
import { cancelAndRefundOrder, refundOrder, RefundError } from "@/lib/order-refunds"
import { editPendingOrder, orderForUpdateSelect, recordOrderPayment, STATUS_CHANGED, updateOrderStatus, type Failure } from "@/lib/order-updates"
import {
  cancelAndRefundOrderSchema,
  recordOrderPaymentSchema,
  refundOrderSchema,
  updateOrderCustomerSchema,
  updateOrderDeliverySchema,
  updateOrderNotesSchema,
  updateOrderStatusSchema,
} from "@/lib/schemas/order.schemas"
import { StatusChangedError } from "@/lib/store-order-writes"

// The platform's order actions: any order, whichever stores' items it has. Every export here is a public endpoint,
// so every input is validated, and each one calls its guard before its try block (its redirect throws, which the
// catch would swallow). Stores' own actions are in store-order.actions.ts; both share lib/order-updates.ts.

function invalidInput(error: z.ZodError): Failure {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const NOT_FOUND: Failure = { success: false, error: "Order not found.", code: "NOT_FOUND" }
const PAID_ORDER: Failure = {
  success: false,
  error: "This order has been paid, so cancelling it needs a refund: a superAdmin can use Cancel and refund.",
  code: "PAID_ORDER",
}

const loadOrder = (orderId: string) => prisma.order.findUnique({ where: { id: orderId }, select: orderForUpdateSelect })

export async function updateOrderStatusAction(input: z.input<typeof updateOrderStatusSchema>): Promise<ActionResponse> {
  const session = await requireSystemPermission({ order: ["update"] })

  try {
    const parsed = updateOrderStatusSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { orderId, ...change } = parsed.data

    const order = await loadOrder(orderId)
    if (!order) return NOT_FOUND

    return await updateOrderStatus(order, { ...change, orderId, changedById: session.user.id }, PAID_ORDER)
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function recordOrderPaymentAction(input: z.input<typeof recordOrderPaymentSchema>): Promise<ActionResponse> {
  const session = await requireSystemPermission({ order: ["update"] })

  try {
    const parsed = recordOrderPaymentSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { orderId, paymentMethod } = parsed.data

    const order = await loadOrder(orderId)
    if (!order) return NOT_FOUND

    return await recordOrderPayment(order, { orderId, paymentMethod, recordedById: session.user.id })
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// ============================================
// EDITING A PENDING ORDER
// ============================================

export async function updateOrderCustomerAction(input: z.input<typeof updateOrderCustomerSchema>): Promise<ActionResponse> {
  await requireSystemPermission({ order: ["update"] })

  try {
    const parsed = updateOrderCustomerSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { orderId, customerName, customerEmail, customerPhone } = parsed.data

    return await editPendingOrder(orderId, {
      customerName,
      customerEmail: customerEmail.toLowerCase() || null,
      customerPhone: customerPhone || null,
    })
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// The address only: switching between delivery and pickup would change the shipping fee, so it isn't offered
export async function updateOrderDeliveryAction(input: z.input<typeof updateOrderDeliverySchema>): Promise<ActionResponse> {
  await requireSystemPermission({ order: ["update"] })

  try {
    const parsed = updateOrderDeliverySchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { orderId, shippingName, shippingPhone, shippingLine1, shippingLine2, shippingRegion, shippingTown } = parsed.data

    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { shippingMethod: true } })
    if (!order) return NOT_FOUND
    if (order.shippingMethod !== ShippingMethod.DELIVERY) return { success: false, error: "This order is a pickup, so it has no delivery address.", code: "NOT_DELIVERY" }

    return await editPendingOrder(orderId, {
      shippingName,
      shippingPhone,
      shippingLine1,
      shippingLine2: shippingLine2 || null,
      shippingRegion,
      shippingTown,
    })
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function updateOrderNotesAction(input: z.input<typeof updateOrderNotesSchema>): Promise<ActionResponse> {
  await requireSystemPermission({ order: ["update"] })

  try {
    const parsed = updateOrderNotesSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { orderId, notes } = parsed.data

    return await editPendingOrder(orderId, { notes: notes || null })
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// ============================================
// REFUNDS (superAdmins only)
// ============================================

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

export async function refundOrderAction(input: z.input<typeof refundOrderSchema>): Promise<ActionResponse> {
  const session = await requireSystemPermission({ order: ["refund"] })

  try {
    const parsed = refundOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { orderId, amountGhs, refundedGhs, method, reason } = parsed.data

    const amount = new Prisma.Decimal(amountGhs.toFixed(2))
    await prisma.$transaction((tx) => refundOrder(tx, { orderId, amountGhs: amount, refundedGhs: new Prisma.Decimal(refundedGhs), method, reason, refundedById: session.user.id }), TRANSACTION_OPTIONS)

    // Only once the refund is saved: after() also runs when an action fails
    after(() => sendOrderEmail(orderId, "REFUNDED", reason, amount.toFixed(2)))

    return { success: true }
  } catch (error) {
    if (error instanceof RefundError) return { success: false, error: error.message, code: error.code }
    return { success: false, error: formatError(error) }
  }
}

// Refunds whatever is left and cancels the order, putting its stock back. For a paid order that hasn't left yet.
export async function cancelAndRefundOrderAction(input: z.input<typeof cancelAndRefundOrderSchema>): Promise<ActionResponse> {
  const session = await requireSystemPermission({ order: ["refund"] })

  try {
    const parsed = cancelAndRefundOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { orderId, refundedGhs, currentStatus, method, reason } = parsed.data

    const result = await prisma.$transaction(
      (tx) => cancelAndRefundOrder(tx, { orderId, refundedGhs: new Prisma.Decimal(refundedGhs), currentStatus, method, reason, refundedById: session.user.id }),
      TRANSACTION_OPTIONS
    )

    // Only once both are saved. The customer hears of the cancellation, then of the money coming back.
    after(async () => {
      await sendOrderEmail(orderId, "CANCELLED", reason)
      if (result.refundedGhs.gt(0)) await sendOrderEmail(orderId, "REFUNDED", reason, result.refundedGhs.toFixed(2))
    })

    return { success: true }
  } catch (error) {
    if (error instanceof StatusChangedError) return STATUS_CHANGED
    if (error instanceof RefundError) return { success: false, error: error.message, code: error.code }
    return { success: false, error: formatError(error) }
  }
}
