"use server"

import { after } from "next/server"
import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { getPricingContext } from "@workspace/commerce/exchange-rates"
import { notifyNewOrder, notifyStockAlerts } from "@workspace/commerce/notifications"
import { sendOrderEmail } from "@workspace/commerce/order-emails"
import { OrderItemError } from "@workspace/commerce/order-writes"
import { ActionResponse, DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { ShippingMethod } from "@workspace/db/enums"
import { requireSystemPermission } from "@/lib/auth-guard"
import {
  cancelOrderInstallation,
  cancelWithRefund,
  editPendingOrder,
  giveRefund,
  orderForUpdateSelect,
  recordOrderPayment,
  recordReturn,
  toReturnInput,
  updateInstallation,
  updateOrderStatus,
  type Failure,
} from "@/lib/order-updates"
import {
  cancelAndRefundOrderSchema,
  cancelInstallationSchema,
  createOrderSchema,
  updateInstallationSchema,
  recordOrderPaymentSchema,
  refundOrderSchema,
  returnOrderSchema,
  updateOrderCustomerSchema,
  updateOrderDeliverySchema,
  updateOrderNotesSchema,
  updateOrderStatusSchema,
} from "@/lib/schemas/order.schemas"
import { createStaffOrder } from "@/lib/staff-orders"
import { StaffQuoteError } from "@/lib/staff-quotes"

// The platform's order actions: any order, whichever stores' items it has. Every export here is a public endpoint,
// so every input is validated, and each one calls its guard before its try block (its redirect throws, which the
// catch would swallow). Stores' own actions are in store-order.actions.ts; both share lib/order-updates.ts.

function invalidInput(error: z.ZodError): Failure {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const NOT_FOUND: Failure = { success: false, error: "Order not found.", code: "NOT_FOUND" }
const PAID_ORDER: Failure = {
  success: false,
  error: "This order has been paid, so cancelling it needs a refund. Ask a superAdmin to cancel and refund it.",
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
// REFUNDS AND RETURNS (superAdmins; stores give their own in store-order.actions.ts)
// ============================================

export async function refundOrderAction(input: z.input<typeof refundOrderSchema>): Promise<ActionResponse> {
  const session = await requireSystemPermission({ order: ["refund"] })

  try {
    const parsed = refundOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { orderId, amountGhs, refundedGhs, method, reason } = parsed.data

    return await giveRefund({ orderId, amountGhs: new Prisma.Decimal(amountGhs.toFixed(2)), refundedGhs: new Prisma.Decimal(refundedGhs), method, reason, refundedById: session.user.id }, null)
  } catch (error) {
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

    return await cancelWithRefund({ orderId, refundedGhs: new Prisma.Decimal(refundedGhs), currentStatus, method, reason, refundedById: session.user.id }, null)
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Items a customer brought back after delivery. Shipping isn't refunded; the order's status stays as it is.
export async function returnOrderItemsAction(input: z.input<typeof returnOrderSchema>): Promise<ActionResponse> {
  const session = await requireSystemPermission({ order: ["refund"] })

  try {
    const parsed = returnOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)

    return await recordReturn(toReturnInput(parsed.data, session.user.id), null)
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// ============================================
// INSTALLATION (the platform's installers, so the platform's staff)
// ============================================

export async function updateInstallationAction(input: z.input<typeof updateInstallationSchema>): Promise<ActionResponse> {
  const session = await requireSystemPermission({ order: ["update"] })

  try {
    const parsed = updateInstallationSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { orderId, currentStatus, status, date, note } = parsed.data

    return await updateInstallation({ orderId, from: currentStatus, to: status, date, note: note || null, changedById: session.user.id })
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Money goes back, so it takes the refund permission
export async function cancelInstallationAction(input: z.input<typeof cancelInstallationSchema>): Promise<ActionResponse> {
  const session = await requireSystemPermission({ order: ["refund"] })

  try {
    const parsed = cancelInstallationSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { orderId, amountGhs, refundedGhs, currentStatus, method, reason } = parsed.data

    return await cancelOrderInstallation({
      orderId,
      amountGhs: new Prisma.Decimal(amountGhs.toFixed(2)),
      refundedGhs: new Prisma.Decimal(refundedGhs),
      from: currentStatus,
      method,
      reason,
      refundedById: session.user.id,
    })
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// ============================================
// CREATING ORDERS
// ============================================

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

// An order for a customer, made by the platform's staff: items from any store, as the storefront would sell them,
// with installation where it's offered. It starts unpaid; staff record the payment when it arrives. The wizard's
// other steps search, look the customer up and price through the quotation actions, which work the same way.
export async function createOrderAction(input: z.input<typeof createOrderSchema>): Promise<DataResponse<{ id: string; reference: string }>> {
  const session = await requireSystemPermission({ order: ["create"] })

  try {
    const parsed = createOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const data = parsed.data

    // Creating an order alone doesn't allow a discount, as in a store's workspace
    if (data.discountType !== "NONE" && !hasSystemPermission(session.user.role, { order: ["update"] })) {
      return { success: false, error: "Your role can't give discounts.", code: "FORBIDDEN" }
    }

    const pricing = await getPricingContext()
    if (!pricing) {
      return { success: false, error: "There's no current exchange rate, so the order can't be priced. Ask a superAdmin to set today's rate in Settings.", code: "NO_RATE" }
    }

    const { stockAlerts, ...order } = await prisma.$transaction(
      (tx) =>
        createStaffOrder(
          tx,
          pricing,
          {
            customerUserId: data.customerUserId,
            name: data.customerName,
            email: data.customerEmail || null,
            phone: data.customerPhone || null,
            recipientName: data.shippingName,
            recipientPhone: data.shippingPhone,
            line1: data.shippingLine1,
            line2: data.shippingLine2,
            region: data.shippingRegion,
            town: data.shippingTown,
            items: data.items,
            shippingGhs: new Prisma.Decimal(data.shippingGhs),
            discount: data.discountType === "NONE" ? null : { type: data.discountType, value: new Prisma.Decimal(data.discountValue), reason: data.discountReason },
            paymentMethod: data.paymentMethod,
            notes: data.notes,
            expectedTotalGhs: new Prisma.Decimal(data.expectedTotalGhs),
          },
          session.user.id
        ),
      TRANSACTION_OPTIONS
    )

    // Only once the order is saved: after() also runs when an action fails
    after(async () => {
      await sendOrderEmail(order.id, "CREATED")
      await notifyNewOrder(order.id, "platform")
      await notifyStockAlerts(stockAlerts)
    })
    return { success: true, data: order }
  } catch (error) {
    if (error instanceof OrderItemError || error instanceof StaffQuoteError) return { success: false, error: error.message, code: error.code }
    return { success: false, error: formatError(error) }
  }
}
