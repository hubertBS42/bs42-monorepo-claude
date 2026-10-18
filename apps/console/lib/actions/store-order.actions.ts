"use server"

import { after } from "next/server"
import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import { consoleAdminRoles, hasSystemPermission, hasSystemRole } from "@workspace/auth/system-permissions"
import { ActionResponse, DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { ShippingMethod, Status } from "@workspace/db/enums"
import { hasStorePermission, requireConsoleAccess } from "@/lib/auth-guard"
import { getLatestExchangeRate, type ExchangeRateInfo } from "@/lib/data/exchange-rates.data"
import { notifyNewOrder, notifyStockAlerts } from "@/lib/notifications"
import { sendOrderEmail } from "@/lib/order-emails"
import { priceOrder, type PricedOrder } from "@/lib/order-pricing"
import { cancelWithRefund, editPendingOrder, giveRefund, orderForUpdateSelect, recordOrderPayment, recordReturn, toReturnInput, updateOrderStatus, type Failure } from "@/lib/order-updates"
import {
  cancelAndRefundStoreOrderSchema,
  createStoreOrderSchema,
  findOrderCustomerSchema,
  previewStoreOrderSchema,
  recordStorePaymentSchema,
  refundStoreOrderSchema,
  returnStoreOrderSchema,
  searchOrderableListingsSchema,
  updateStoreOrderCustomerSchema,
  updateStoreOrderDeliverySchema,
  updateStoreOrderNotesSchema,
  updateStoreOrderStatusSchema,
} from "@/lib/schemas/order.schemas"
import { createStoreOrder, OrderItemError, resolveOrderLines, type ResolvedLine } from "@/lib/store-order-writes"
import type { OrderableListing, OrderCustomer, OrderPreview } from "@/types"

// Every export here is a public endpoint, so every input is validated, and each one calls requireConsoleAccess
// before its try block (its redirect throws, which the catch would swallow). A store manages only orders made up
// entirely of its own items; an order spanning stores is the platform's (the global orders pages).

function invalidInput(error: z.ZodError): Failure {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const FORBIDDEN: Failure = { success: false, error: "Your role in this store can't manage orders.", code: "FORBIDDEN" }
const NOT_FOUND: Failure = { success: false, error: "Order not found.", code: "NOT_FOUND" }
const MULTI_STORE: Failure = { success: false, error: "This order has items from other stores, so the platform manages it.", code: "MULTI_STORE" }
const PAID_ORDER: Failure = { success: false, error: "This order has been paid, so cancelling it needs a refund: an owner or admin can use Cancel and refund.", code: "PAID_ORDER" }
const NO_REFUNDS: Failure = { success: false, error: "Only the store's owners and admins can give refunds and record returns.", code: "FORBIDDEN" }

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

// The order with what the updates need, or a response when the store can't manage it
async function loadManageableOrder(orderId: string, storeId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, orderItems: { some: { organizationId: storeId } } }, select: orderForUpdateSelect })
  if (!order) return { problem: NOT_FOUND }
  if (order.orderItems.some((item) => item.organizationId !== storeId)) return { problem: MULTI_STORE }
  return { order }
}

export async function updateStoreOrderStatusAction(input: z.input<typeof updateStoreOrderStatusSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = updateStoreOrderStatusSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, orderId, ...change } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { order: ["update"] }))) return FORBIDDEN

    const { order, problem } = await loadManageableOrder(orderId, storeId)
    if (problem) return problem

    return await updateOrderStatus(order, { ...change, orderId, changedById: session.user.id }, PAID_ORDER)
  } catch (error) {
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

    return await recordOrderPayment(order, { orderId, paymentMethod, recordedById: session.user.id })
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// ============================================
// CREATING ORDERS
// ============================================

const NO_RATE: Failure = {
  success: false,
  error: "There's no current exchange rate, so the order can't be priced. Ask a platform admin to set today's rate in Settings.",
  code: "NO_RATE",
}

const MAX_ORDERABLE_LISTINGS = 30

function itemError(error: OrderItemError): Failure {
  return { success: false, error: error.message, code: error.code }
}

// The rate and tax settings an order is priced with, or a response when there's no usable rate
async function getPricingContext(): Promise<{ ok: false; problem: Failure } | { ok: true; rate: ExchangeRateInfo; tax: { rate: Prisma.Decimal; onShipping: boolean } | null }> {
  const [rate, settings] = await Promise.all([getLatestExchangeRate(), prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { taxEnabled: true, taxRate: true, taxShipping: true } })])
  if (!rate || rate.isStale) return { ok: false, problem: NO_RATE }
  return {
    ok: true,
    rate,
    // Read as a Decimal here: AppSettingsData.taxRate is a plain number only so it can reach client components
    tax: settings?.taxEnabled ? { rate: settings.taxRate, onShipping: settings.taxShipping } : null,
  }
}

type DiscountInput = { discountType: "NONE" | "FIXED" | "PERCENTAGE"; discountValue: number }

function toDiscount({ discountType, discountValue }: DiscountInput) {
  return discountType === "NONE" ? null : { type: discountType, value: new Prisma.Decimal(discountValue) }
}

type StorePricing = { ok: false; problem: Failure } | { ok: true; lines: ResolvedLine[]; priced: PricedOrder; rate: ExchangeRateInfo; discount: ReturnType<typeof toDiscount> }

// Prices the lines at the store's prices, or returns why it can't
async function priceStoreOrder(storeId: string, input: { items: z.output<typeof previewStoreOrderSchema>["items"]; shippingGhs: number } & DiscountInput): Promise<StorePricing> {
  const context = await getPricingContext()
  if (!context.ok) return context

  let lines: ResolvedLine[]
  try {
    lines = await resolveOrderLines(prisma, storeId, input.items)
  } catch (error) {
    if (error instanceof OrderItemError) return { ok: false, problem: itemError(error) }
    throw error
  }

  const discount = toDiscount(input)
  const priced = priceOrder({
    lines,
    exchangeRate: new Prisma.Decimal(context.rate.rate),
    shippingGhs: new Prisma.Decimal(input.shippingGhs),
    discount,
    tax: context.tax,
  })
  if (discount?.type === "FIXED" && discount.value.gt(priced.subtotalGhs)) {
    return { ok: false, problem: { success: false, error: "The discount is more than the items cost.", code: "DISCOUNT_TOO_LARGE" } }
  }
  return { ok: true, lines, priced, rate: context.rate, discount }
}

// Only owners and admins give discounts: creating an order alone doesn't allow one
async function checkCreatePermissions(userId: string, storeId: string, discountType: DiscountInput["discountType"]): Promise<Failure | undefined> {
  if (!(await hasStorePermission(userId, storeId, { order: ["create"] }))) return FORBIDDEN
  if (discountType !== "NONE" && !(await hasStorePermission(userId, storeId, { order: ["update"] }))) {
    return { success: false, error: "Your role in this store can't give discounts.", code: "FORBIDDEN" }
  }
  return undefined
}

function toPreview(lines: ResolvedLine[], priced: PricedOrder, rate: { rate: string; date: string }): OrderPreview {
  return {
    lines: lines.map((line, index) => ({
      listingId: line.listingId,
      listingVariantId: line.listingVariantId,
      label: line.label,
      quantity: line.quantity,
      unitPriceGhs: priced.lines[index]!.unitPriceGhs.toFixed(2),
      totalPriceGhs: priced.lines[index]!.totalPriceGhs.toFixed(2),
      stock: line.trackInventory ? line.stock : null,
    })),
    subtotalGhs: priced.subtotalGhs.toFixed(2),
    discountAmountGhs: priced.discountAmountGhs?.toFixed(2) ?? null,
    shippingGhs: priced.shippingGhs.toFixed(2),
    taxRate: priced.taxRate.toString(),
    taxGhs: priced.taxGhs.toFixed(2),
    totalGhs: priced.totalGhs.toFixed(2),
    exchangeRate: rate.rate,
    rateDate: rate.date,
  }
}

// The review step's prices, from the same code createStoreOrderAction prices with
export async function previewStoreOrderAction(input: z.input<typeof previewStoreOrderSchema>): Promise<DataResponse<OrderPreview>> {
  const session = await requireConsoleAccess()

  try {
    const parsed = previewStoreOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, ...rest } = parsed.data

    const denied = await checkCreatePermissions(session.user.id, storeId, rest.discountType)
    if (denied) return denied

    const result = await priceStoreOrder(storeId, rest)
    if (!result.ok) return result.problem
    return { success: true, data: toPreview(result.lines, result.priced, result.rate) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function createStoreOrderAction(input: z.input<typeof createStoreOrderSchema>): Promise<DataResponse<{ id: string; reference: string }>> {
  const session = await requireConsoleAccess()

  try {
    const parsed = createStoreOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const data = parsed.data

    const denied = await checkCreatePermissions(session.user.id, data.storeId, data.discountType)
    if (denied) return denied

    // A customer found by lookup must still exist; their details are copied onto the order
    if (data.customerUserId && !(await prisma.user.findUnique({ where: { id: data.customerUserId }, select: { id: true } }))) {
      return { success: false, error: "That customer's account no longer exists. Look them up again.", code: "CUSTOMER_NOT_FOUND" }
    }

    const result = await priceStoreOrder(data.storeId, data)
    if (!result.ok) return result.problem

    const isDelivery = data.shippingMethod === ShippingMethod.DELIVERY
    const { stockAlerts, ...order } = await prisma.$transaction(
      (tx) =>
        createStoreOrder(tx, {
          storeId: data.storeId,
          createdById: session.user.id,
          customer: { userId: data.customerUserId, name: data.customerName, email: data.customerEmail.toLowerCase() || null, phone: data.customerPhone || null },
          shippingMethod: data.shippingMethod,
          shipping: isDelivery
            ? {
                name: data.shippingName,
                phone: data.shippingPhone,
                line1: data.shippingLine1,
                line2: data.shippingLine2 || null,
                region: data.shippingRegion,
                town: data.shippingTown,
              }
            : null,
          notes: data.notes || null,
          discount: result.discount && { ...result.discount, reason: data.discountReason },
          rate: { id: result.rate.id, value: new Prisma.Decimal(result.rate.rate) },
          lines: result.lines,
          priced: result.priced,
        }),
      TRANSACTION_OPTIONS
    )

    // Only once the order is saved: after() also runs when an action fails
    after(async () => {
      await sendOrderEmail(order.id, "CREATED")
      await notifyNewOrder(order.id, "staff")
      await notifyStockAlerts(stockAlerts)
    })

    return { success: true, data: order }
  } catch (error) {
    if (error instanceof OrderItemError) return itemError(error)
    return { success: false, error: formatError(error) }
  }
}

// An exact email or phone match only, so staff can't browse the platform's customers
export async function findOrderCustomerAction(input: z.input<typeof findOrderCustomerSchema>): Promise<DataResponse<OrderCustomer | null>> {
  const session = await requireConsoleAccess()

  try {
    const parsed = findOrderCustomerSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, email, phone } = parsed.data
    if (!email && !phone) return { success: false, error: "Enter an email or a phone number.", code: "INVALID" }

    if (!(await hasStorePermission(session.user.id, storeId, { order: ["create"] }))) return FORBIDDEN

    const customer = await prisma.user.findFirst({
      where: email ? { email: email.toLowerCase() } : { phone },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          select: { id: true, name: true, phone: true, line1: true, line2: true, region: true, town: true, isDefault: true },
        },
      },
    })

    return { success: true, data: customer }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// The store's listings on sale, for the items step: published, with a published product, and their variants on sale
export async function searchOrderableListingsAction(input: z.input<typeof searchOrderableListingsSchema>): Promise<DataResponse<OrderableListing[]>> {
  const session = await requireConsoleAccess()

  try {
    const parsed = searchOrderableListingsSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, search } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { order: ["create"] }))) return FORBIDDEN

    const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
    const [listings, rate] = await Promise.all([
      prisma.storeListing.findMany({
        where: {
          organizationId: storeId,
          status: Status.PUBLISHED,
          product: { status: Status.PUBLISHED, ...(contains && { OR: [{ name: contains }, { sku: contains }, { variants: { some: { sku: contains } } }] }) },
        },
        orderBy: [{ product: { name: "asc" } }, { id: "asc" }],
        take: MAX_ORDERABLE_LISTINGS,
        select: {
          id: true,
          sellPrice: true,
          stock: true,
          trackInventory: true,
          product: { select: { name: true, sku: true, images: true, hasVariants: true, brand: { select: { name: true } } } },
          storeListingVariants: {
            where: { status: Status.PUBLISHED, variant: { status: { not: Status.ARCHIVED } } },
            orderBy: [{ variant: { position: "asc" } }],
            select: {
              id: true,
              sellPrice: true,
              stock: true,
              trackInventory: true,
              variant: { select: { sku: true, variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } } } },
            },
          },
        },
      }),
      getLatestExchangeRate(),
    ])

    const usableRate = rate && !rate.isStale ? new Prisma.Decimal(rate.rate) : null
    const toGhs = (usd: Prisma.Decimal) => (usableRate ? usd.times(usableRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2) : null)

    return {
      success: true,
      data: listings.flatMap((listing) => {
        const { product } = listing
        const rows = product.hasVariants
          ? listing.storeListingVariants.map((row) => {
              const values = [...row.variant.variantValues].sort((a, b) => a.optionValue.option.position - b.optionValue.option.position)
              const price = row.sellPrice ?? listing.sellPrice
              return {
                listingVariantId: row.id,
                variantDescription: values.map(({ optionValue }) => `${optionValue.option.name}: ${optionValue.value}`).join(" / "),
                sku: row.variant.sku,
                priceUsd: price.toFixed(2),
                priceGhs: toGhs(price),
                stock: row.trackInventory ? row.stock : null,
              }
            })
          : [
              {
                listingVariantId: null,
                variantDescription: null,
                sku: product.sku,
                priceUsd: listing.sellPrice.toFixed(2),
                priceGhs: toGhs(listing.sellPrice),
                stock: listing.trackInventory ? listing.stock : null,
              },
            ]
        // A product with variants but none on sale has nothing to order
        return rows.length ? [{ listingId: listing.id, productName: product.name, brandName: product.brand.name, image: product.images[0] ?? null, rows }] : []
      }),
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// ============================================
// EDITING A PENDING ORDER
// ============================================

// Every edit needs order:update and an order of the store's own items; editPendingOrder writes only while it's pending
async function editStorePendingOrder(userId: string, storeId: string, orderId: string, data: Prisma.OrderUpdateManyMutationInput): Promise<ActionResponse> {
  if (!(await hasStorePermission(userId, storeId, { order: ["update"] }))) return FORBIDDEN

  const { problem } = await loadManageableOrder(orderId, storeId)
  if (problem) return problem

  return editPendingOrder(orderId, data)
}

export async function updateStoreOrderCustomerAction(input: z.input<typeof updateStoreOrderCustomerSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = updateStoreOrderCustomerSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, orderId, customerName, customerEmail, customerPhone } = parsed.data

    return await editStorePendingOrder(session.user.id, storeId, orderId, {
      customerName,
      customerEmail: customerEmail.toLowerCase() || null,
      customerPhone: customerPhone || null,
    })
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// The address only: switching between delivery and pickup would change the shipping fee, so it isn't offered
export async function updateStoreOrderDeliveryAction(input: z.input<typeof updateStoreOrderDeliverySchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = updateStoreOrderDeliverySchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, orderId, shippingName, shippingPhone, shippingLine1, shippingLine2, shippingRegion, shippingTown } = parsed.data

    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { shippingMethod: true } })
    if (order?.shippingMethod !== ShippingMethod.DELIVERY) return { success: false, error: "This order is a pickup, so it has no delivery address.", code: "NOT_DELIVERY" }

    return await editStorePendingOrder(session.user.id, storeId, orderId, {
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

export async function updateStoreOrderNotesAction(input: z.input<typeof updateStoreOrderNotesSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = updateStoreOrderNotesSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, orderId, notes } = parsed.data

    return await editStorePendingOrder(session.user.id, storeId, orderId, { notes: notes || null })
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// ============================================
// REFUNDS AND RETURNS (owners and admins)
// ============================================

// The same as the platform's (lib/order-updates.ts), on the store's own orders. Each one tells the platform's staff
// when a store's staff give money back (Settings → Notifications).

// The user may give refunds in the store, and the order is made only of its items; the refund code locks the order
// and checks the rest. System admins are members of every store, but refund by their system role, as on the platform:
// admins can't, superAdmins can. Returns the store to name in the staff notice: none for a superAdmin's refund.
async function checkRefundable(user: { id: string; role?: string | null }, storeId: string, orderId: string): Promise<{ problem: Failure } | { notify: string | null }> {
  const isPlatformStaff = hasSystemRole(user.role, consoleAdminRoles)
  const allowed = isPlatformStaff ? hasSystemPermission(user.role, { order: ["refund"] }) : await hasStorePermission(user.id, storeId, { order: ["refund"] })
  if (!allowed) return { problem: NO_REFUNDS }

  const { problem } = await loadManageableOrder(orderId, storeId)
  if (problem) return { problem }
  return { notify: isPlatformStaff ? null : storeId }
}

export async function refundStoreOrderAction(input: z.input<typeof refundStoreOrderSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = refundStoreOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, orderId, amountGhs, refundedGhs, method, reason } = parsed.data

    const check = await checkRefundable(session.user, storeId, orderId)
    if ("problem" in check) return check.problem

    return await giveRefund({ orderId, amountGhs: new Prisma.Decimal(amountGhs.toFixed(2)), refundedGhs: new Prisma.Decimal(refundedGhs), method, reason, refundedById: session.user.id }, check.notify)
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function cancelAndRefundStoreOrderAction(input: z.input<typeof cancelAndRefundStoreOrderSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = cancelAndRefundStoreOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, orderId, refundedGhs, currentStatus, method, reason } = parsed.data

    const check = await checkRefundable(session.user, storeId, orderId)
    if ("problem" in check) return check.problem

    return await cancelWithRefund({ orderId, refundedGhs: new Prisma.Decimal(refundedGhs), currentStatus, method, reason, refundedById: session.user.id }, check.notify)
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function returnStoreOrderItemsAction(input: z.input<typeof returnStoreOrderSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = returnStoreOrderSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, ...values } = parsed.data

    const check = await checkRefundable(session.user, storeId, values.orderId)
    if ("problem" in check) return check.problem

    return await recordReturn(toReturnInput(values, session.user.id), check.notify)
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
