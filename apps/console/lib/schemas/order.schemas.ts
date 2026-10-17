import z from "zod"
import { GEODATA } from "@workspace/contracts"
import { DiscountType, OrderStatus, PaymentMethod, ShippingMethod } from "@workspace/db/enums"
import { isPossiblePhoneNumber } from "@workspace/utils/phone"
import { decimalSchema } from "@/lib/schemas/product.schemas"

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
    // NONE rather than null, so the select always has a value
    discountType: z.enum(["NONE", DiscountType.FIXED, DiscountType.PERCENTAGE]),
    // GHS for FIXED, a percentage for PERCENTAGE
    discountValue: decimalSchema,
    discountReason: z.string().trim().max(500),
    notes: z.string().trim().max(2000, "Keep the notes under 2,000 characters"),
  })
  .superRefine((data, ctx) => {
    const keys = new Set<string>()
    data.items.forEach((item, index) => {
      const key = `${item.listingId}:${item.listingVariantId ?? ""}`
      if (keys.has(key)) ctx.addIssue({ code: "custom", message: "This item is in the order twice", path: ["items", index, "quantity"] })
      keys.add(key)
    })

    if (data.shippingMethod === ShippingMethod.DELIVERY) checkDelivery(data, ctx)
    else if (data.shippingGhs > 0) ctx.addIssue({ code: "custom", message: "A pickup has no shipping fee", path: ["shippingGhs"] })

    if (data.discountType !== "NONE") {
      if (data.discountValue <= 0) ctx.addIssue({ code: "custom", message: "Enter the discount", path: ["discountValue"] })
      if (data.discountType === DiscountType.PERCENTAGE && data.discountValue > 100) ctx.addIssue({ code: "custom", message: "At most 100%", path: ["discountValue"] })
      if (!data.discountReason) ctx.addIssue({ code: "custom", message: "Say why the discount is given", path: ["discountReason"] })
    }
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

const orderEditTarget = { storeId: z.uuid("Invalid store ID"), orderId: z.uuid("Invalid order ID") }
export const updateOrderCustomerSchema = orderCustomerFormSchema.extend(orderEditTarget)
export const updateOrderDeliverySchema = z.object(deliveryFields).extend(orderEditTarget).superRefine(checkDelivery)
export const updateOrderNotesSchema = orderNotesFormSchema.extend(orderEditTarget)
