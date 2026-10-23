import z from "zod"
import { GEODATA } from "@workspace/contracts"
import { DiscountType, InstallationStatus, OrderStatus, PaymentMethod, ShippingMethod } from "@workspace/db/enums"
import { isPossiblePhoneNumber } from "@workspace/utils/phone"
import { decimalSchema } from "@/lib/schemas/product.schemas"
import { quoteItemInputSchema } from "@/lib/schemas/quote.schemas"

export const orderStatusFormSchema = z
  .object({
    status: z.enum(OrderStatus, "Choose a status"),
    note: z.string().trim().max(1000, "Keep the note under 1,000 characters"),
  })
  .superRefine((data, ctx) => {
    // The customer is told why, and the timeline keeps it
    if (data.status === OrderStatus.CANCELLED && !data.note) {
      ctx.addIssue({ code: "custom", message: "Give a reason for cancelling", path: ["note"] })
    }
  })

// The store and the status the page showed come from the page: the action refuses if the order moved on meanwhile
export const updateStoreOrderStatusSchema = orderStatusFormSchema.extend({
  storeId: z.uuid("Invalid store ID"),
  orderId: z.uuid("Invalid order ID"),
  currentStatus: z.enum(OrderStatus),
})

export const recordStorePaymentSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
  orderId: z.uuid("Invalid order ID"),
  paymentMethod: z.enum(PaymentMethod, "Choose how the customer paid"),
})

// ============================================
// CREATING AND EDITING ORDERS
// ============================================

const optionalPhoneSchema = z
  .string()
  .trim()
  .refine((value) => !value || isPossiblePhoneNumber(value), "Invalid phone number")

const optionalEmailSchema = z
  .string()
  .trim()
  .refine((value) => !value || z.email().safeParse(value).success, "Invalid email address")

// A line as the form sends it: the server looks up its price, never trusting one from the browser
export const orderItemInputSchema = z.object({
  listingId: z.uuid(),
  listingVariantId: z.uuid().nullable(),
  quantity: z.number("Enter a quantity").int("Enter a whole number").min(1, "At least 1").max(999, "At most 999"),
})

const customerFields = {
  customerName: z.string().trim().min(1, "Enter the customer's name").max(200),
  // Optional: a walk-in customer may give neither. Without an email they get no order emails.
  customerEmail: optionalEmailSchema,
  customerPhone: optionalPhoneSchema,
}

const deliveryFields = {
  shippingName: z.string().trim().max(200),
  shippingPhone: optionalPhoneSchema,
  shippingLine1: z.string().trim().max(300),
  shippingLine2: z.string().trim().max(300),
  shippingRegion: z.string(),
  shippingTown: z.string(),
}

type DeliveryInput = { [K in keyof typeof deliveryFields]: string }

// For a delivery: who receives it and where, with the region and town from the Ghana list
function checkDelivery(data: DeliveryInput, ctx: z.RefinementCtx) {
  if (!data.shippingName) ctx.addIssue({ code: "custom", message: "Enter who receives the order", path: ["shippingName"] })
  if (!data.shippingPhone) ctx.addIssue({ code: "custom", message: "Enter a phone number for the delivery", path: ["shippingPhone"] })
  if (!data.shippingLine1) ctx.addIssue({ code: "custom", message: "Enter the address", path: ["shippingLine1"] })
  const region = GEODATA.find((item) => item.name === data.shippingRegion)
  if (!region) ctx.addIssue({ code: "custom", message: "Choose a region", path: ["shippingRegion"] })
  else if (!region.towns.includes(data.shippingTown)) ctx.addIssue({ code: "custom", message: "Choose a town in the region", path: ["shippingTown"] })
}

const discountFields = {
  // NONE rather than null, so the select always has a value
  discountType: z.enum(["NONE", DiscountType.FIXED, DiscountType.PERCENTAGE]),
  // GHS for FIXED, a percentage for PERCENTAGE
  discountValue: decimalSchema,
  discountReason: z.string().trim().max(500),
}

type DiscountInput = { discountType: "NONE" | "FIXED" | "PERCENTAGE"; discountValue: number; discountReason: string }

// A discount needs an amount and a reason
function checkDiscount(data: DiscountInput, ctx: z.RefinementCtx) {
  if (data.discountType === "NONE") return
  if (data.discountValue <= 0) ctx.addIssue({ code: "custom", message: "Enter the discount", path: ["discountValue"] })
  if (data.discountType === DiscountType.PERCENTAGE && data.discountValue > 100) ctx.addIssue({ code: "custom", message: "At most 100%", path: ["discountValue"] })
  if (!data.discountReason) ctx.addIssue({ code: "custom", message: "Say why the discount is given", path: ["discountReason"] })
}

// Each line once: a second one would be priced and reserved separately
function checkDistinctItems(items: { listingId: string; listingVariantId: string | null }[], ctx: z.RefinementCtx) {
  const keys = new Set<string>()
  items.forEach((item, index) => {
    const key = `${item.listingId}:${item.listingVariantId ?? ""}`
    if (keys.has(key)) ctx.addIssue({ code: "custom", message: "This item is in the order twice", path: ["items", index, "quantity"] })
    keys.add(key)
  })
}

// The create wizard's form: one schema for every step, which each check their own fields before moving on
export const createStoreOrderFormSchema = z
  .object({
    // The customer's account, when they were found by email or phone; null for a walk-in
    customerUserId: z.uuid().nullable(),
    ...customerFields,
    items: z.array(orderItemInputSchema).min(1, "Add at least one item").max(50, "At most 50 lines in one order"),
    shippingMethod: z.enum(ShippingMethod),
    ...deliveryFields,
    // GHS, set by staff
    shippingGhs: decimalSchema,
    ...discountFields,
    notes: z.string().trim().max(2000, "Keep the notes under 2,000 characters"),
  })
  .superRefine((data, ctx) => {
    checkDistinctItems(data.items, ctx)
    if (data.shippingMethod === ShippingMethod.DELIVERY) checkDelivery(data, ctx)
    else if (data.shippingGhs > 0) ctx.addIssue({ code: "custom", message: "A pickup has no shipping fee", path: ["shippingGhs"] })

    checkDiscount(data, ctx)
  })

// The store comes from the page, so an order can't land in a store the user switched to in another tab
export const createStoreOrderSchema = createStoreOrderFormSchema.extend({
  storeId: z.uuid("Invalid store ID"),
})

// What the review step prices: no customer, since it doesn't change the price
export const previewStoreOrderSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
  items: z.array(orderItemInputSchema).min(1).max(50),
  shippingGhs: decimalSchema,
  discountType: z.enum(["NONE", DiscountType.FIXED, DiscountType.PERCENTAGE]),
  discountValue: decimalSchema,
})

export const findOrderCustomerSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
  // An exact email or phone number: staff can't browse the platform's customers
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
})

export const searchOrderableListingsSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
  search: z.string().trim().max(100),
})

// Editing a pending order. The delivery method and fee stay as they are: changing them would reprice the order.
export const orderCustomerFormSchema = z.object(customerFields)
export const orderDeliveryFormSchema = z.object(deliveryFields).superRefine(checkDelivery)
export const orderNotesFormSchema = z.object({ notes: z.string().trim().max(2000, "Keep the notes under 2,000 characters") })

const storeOrderEditTarget = { storeId: z.uuid("Invalid store ID"), orderId: z.uuid("Invalid order ID") }
export const updateStoreOrderCustomerSchema = orderCustomerFormSchema.extend(storeOrderEditTarget)
export const updateStoreOrderDeliverySchema = z.object(deliveryFields).extend(storeOrderEditTarget).superRefine(checkDelivery)
export const updateStoreOrderNotesSchema = orderNotesFormSchema.extend(storeOrderEditTarget)

// ============================================
// THE PLATFORM'S ORDERS
// ============================================

// The platform manages any order, so these name only the order
export const updateOrderStatusSchema = orderStatusFormSchema.extend({
  orderId: z.uuid("Invalid order ID"),
  currentStatus: z.enum(OrderStatus),
})

export const recordOrderPaymentSchema = z.object({
  orderId: z.uuid("Invalid order ID"),
  paymentMethod: z.enum(PaymentMethod, "Choose how the customer paid"),
})

const orderEditTarget = { orderId: z.uuid("Invalid order ID") }
export const updateOrderCustomerSchema = orderCustomerFormSchema.extend(orderEditTarget)
export const updateOrderDeliverySchema = z.object(deliveryFields).extend(orderEditTarget).superRefine(checkDelivery)
export const updateOrderNotesSchema = orderNotesFormSchema.extend(orderEditTarget)

// Ways a customer pays the platform for an order staff made: card payments go through the storefront's checkout
export const STAFF_ORDER_PAYMENT_METHODS = [PaymentMethod.BANK_TRANSFER, PaymentMethod.MOBILE_MONEY, PaymentMethod.CASH] as const

// The platform's create wizard (/orders/create): items from any store as the storefront sells them, with
// installation, delivered. One schema for every step, which each check their own fields before moving on.
export const createOrderFormSchema = z
  .object({
    // The customer's account, when they were found by email or phone
    customerUserId: z.uuid().nullable(),
    ...customerFields,
    items: z.array(quoteItemInputSchema).min(1, "Add at least one item").max(50, "At most 50 lines in one order"),
    ...deliveryFields,
    // GHS, filled in from the delivery fees; staff can change it
    shippingGhs: decimalSchema,
    paymentMethod: z.enum(STAFF_ORDER_PAYMENT_METHODS, "Choose how the customer will pay"),
    ...discountFields,
    notes: z.string().trim().max(2000, "Keep the notes under 2,000 characters"),
  })
  .superRefine((data, ctx) => {
    checkDistinctItems(data.items, ctx)
    checkDelivery(data, ctx)
    checkDiscount(data, ctx)
  })

// The total the review step showed: the action refuses if pricing it again comes to something else (PRICE_CHANGED)
export const createOrderSchema = createOrderFormSchema.extend({
  expectedTotalGhs: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid total"),
})

// Refunds, by superAdmins on any order or a store's owners and admins on its own. The page sends the refunded total it showed: the action refuses if
// someone refunded the order since (REFUNDS_CHANGED), so the same money can't go back twice.
const refundFields = {
  method: z.enum(PaymentMethod, "Choose how the money goes back"),
  reason: z.string().trim().min(1, "Give a reason, which the customer is told").max(500, "Keep the reason under 500 characters"),
}
const refundTarget = {
  orderId: z.uuid("Invalid order ID"),
  refundedGhs: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
}

// The amount starts empty, so a refund is always typed, never the whole order by default
export const refundOrderFormSchema = z.object({
  amountGhs: z
    .union([decimalSchema, z.literal("")])
    .refine((value) => value !== "" && value > 0, "Enter an amount above zero")
    .transform((value) => value as number),
  ...refundFields,
})
export const refundOrderSchema = refundOrderFormSchema.extend(refundTarget)

export const cancelAndRefundFormSchema = z.object(refundFields)
export const cancelAndRefundOrderSchema = cancelAndRefundFormSchema.extend({ ...refundTarget, currentStatus: z.enum(OrderStatus) })

// Items a customer brings back, recorded with an optional refund by whoever may give refunds. The form has a row per line that
// can still come back (quantity 0 leaves it out); the page sends how many returns it showed (RETURNS_CHANGED).
export const returnOrderFormSchema = z
  .object({
    items: z.array(
      z.object({
        orderItemId: z.uuid(),
        // A cleared field is 0
        quantity: z.union([z.number("Enter a quantity").int("Enter a whole number").min(0, "At least 0"), z.literal("")]).transform((value) => (value === "" ? 0 : value)),
        restock: z.boolean(),
      })
    ),
    reason: z.string().trim().min(1, "Give a reason, which the customer is told").max(500, "Keep the reason under 500 characters"),
    // Empty or 0 refunds nothing
    refundAmountGhs: z.union([decimalSchema, z.literal("")]).transform((value) => (value === "" ? 0 : value)),
    method: z.enum(PaymentMethod, "Choose how the money goes back"),
  })
  .refine((data) => data.items.some((item) => item.quantity > 0), { message: "Choose at least one item coming back", path: ["items"] })

export const returnOrderSchema = returnOrderFormSchema.safeExtend({ ...refundTarget, returnCount: z.int().min(0) })

// The same, given by a store's owner or admin on one of its own orders. The store comes from the page.
const storeTarget = { storeId: z.uuid("Invalid store ID") }
export const refundStoreOrderSchema = refundOrderSchema.extend(storeTarget)
export const cancelAndRefundStoreOrderSchema = cancelAndRefundOrderSchema.extend(storeTarget)
export const returnStoreOrderSchema = returnOrderSchema.safeExtend(storeTarget)

// ============================================
// INSTALLATION (the platform's staff)
// ============================================

// Booking the installers for a day (again, to move it), or marking the installation done. The note goes to the
// customer with a booking.
const installationFields = {
  status: z.enum([InstallationStatus.BOOKED, InstallationStatus.DONE]),
  note: z.string().trim().max(500, "Keep the note under 500 characters"),
}
// The form's values: the date field holds a Date, sent as a plain day
export const installationFormSchema = z
  .object({ ...installationFields, date: z.date().nullable() })
  .refine((data) => data.status !== InstallationStatus.BOOKED || data.date, { message: "Choose the day", path: ["date"] })
export const updateInstallationSchema = z.object({
  ...installationFields,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .nullable(),
  orderId: z.uuid("Invalid order ID"),
  // The installation status the page showed (INSTALLATION_CHANGED if it moved on)
  currentStatus: z.enum(InstallationStatus),
})

// Cancelling it, with a refund of what it cost (suggested by the page, 0 for none)
export const cancelInstallationFormSchema = z.object({
  amountGhs: z.union([decimalSchema, z.literal("")]).transform((value) => (value === "" ? 0 : value)),
  ...refundFields,
})
export const cancelInstallationSchema = cancelInstallationFormSchema.extend({ ...refundTarget, currentStatus: z.enum(InstallationStatus) })
