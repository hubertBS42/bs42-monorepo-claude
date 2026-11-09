import z from "zod"
import { GEODATA } from "@workspace/contracts"
import { DiscountType, ShippingMethod } from "@workspace/db/enums"
import { isPossiblePhoneNumber } from "@workspace/utils/phone"
import { decimalSchema } from "@/lib/schemas/product.schemas"

// Quotations staff make in the console (lib/actions/quote.actions.ts)

// How long a staff-made quote's prices can hold, in days
export const MAX_QUOTE_VALIDITY_DAYS = 90

// A line as the form sends it: the server looks up its price, never trusting one from the browser
export const quoteItemInputSchema = z.object({
  listingId: z.uuid(),
  listingVariantId: z.uuid().nullable(),
  quantity: z.number("Enter a quantity").int("Enter a whole number").min(1, "At least 1").max(999, "At most 999"),
  // Every unit installed, at the product's fee
  installation: z.boolean(),
})

const discountFields = {
  // NONE rather than null, so the select always has a value
  discountType: z.enum(["NONE", DiscountType.FIXED, DiscountType.PERCENTAGE]),
  // GHS for FIXED, a percentage for PERCENTAGE
  discountValue: decimalSchema,
}

// The create wizard's form: one schema for every step, which each check their own fields before moving on
export const createQuoteFormSchema = z
  .object({
    storeId: z.uuid().nullable().default(null),
    // The customer's account, when they were found by email or phone. Either way the quote belongs to whichever
    // account has its email.
    customerUserId: z.uuid().nullable(),
    customerName: z.string().trim().min(1, "Enter the customer's name").max(200),
    // Required: the quote is emailed, and its email decides who can accept it
    customerEmail: z
      .string()
      .trim()
      .min(1, "Enter the customer's email")
      .refine((value) => z.email().safeParse(value).success, "Invalid email address"),
    customerPhone: z
      .string()
      .trim()
      .min(1, "Enter the customer's phone number")
      .refine((value) => isPossiblePhoneNumber(value), "Invalid phone number"),
    items: z.array(quoteItemInputSchema).min(1, "Add at least one item").max(50, "At most 50 lines in one quotation"),
    // Pickup only for items all from one store, which only pricing it can tell (createStaffQuote)
    shippingMethod: z.enum(ShippingMethod),
    shippingLine1: z.string().trim().max(300),
    shippingLine2: z.string().trim().max(300),
    shippingRegion: z.string(),
    shippingTown: z.string(),
    // GHS, filled in from the delivery fees; staff can change it
    shippingGhs: decimalSchema,
    validityDays: z.number("Enter a number of days").int("Enter a whole number of days").min(1, "At least 1 day").max(MAX_QUOTE_VALIDITY_DAYS, `At most ${MAX_QUOTE_VALIDITY_DAYS} days`),
    notes: z.string().trim().max(2000, "Keep the note under 2,000 characters"),
    ...discountFields,
    discountReason: z.string().trim().max(500),
  })
  .superRefine((data, ctx) => {
    const keys = new Set<string>()
    data.items.forEach((item, index) => {
      const key = `${item.listingId}:${item.listingVariantId ?? ""}`
      if (keys.has(key)) ctx.addIssue({ code: "custom", message: "This item is in the quotation twice", path: ["items", index, "quantity"] })
      keys.add(key)
    })

    if (data.shippingMethod === ShippingMethod.DELIVERY) {
      if (!data.shippingLine1) ctx.addIssue({ code: "custom", message: "Enter the address", path: ["shippingLine1"] })
      const region = GEODATA.find((item) => item.name === data.shippingRegion)
      if (!region) ctx.addIssue({ code: "custom", message: "Choose a region", path: ["shippingRegion"] })
      else if (!region.towns.includes(data.shippingTown)) ctx.addIssue({ code: "custom", message: "Choose a town in the region", path: ["shippingTown"] })
    } else {
      if (data.shippingGhs > 0) ctx.addIssue({ code: "custom", message: "A pickup has no delivery fee", path: ["shippingGhs"] })
      // The installers go to an address
      if (data.items.some((item) => item.installation)) ctx.addIssue({ code: "custom", message: "A pickup can't have installation", path: ["shippingMethod"] })
    }

    if (data.discountType !== "NONE") {
      if (data.discountValue <= 0) ctx.addIssue({ code: "custom", message: "Enter the discount", path: ["discountValue"] })
      if (data.discountType === DiscountType.PERCENTAGE && data.discountValue > 100) ctx.addIssue({ code: "custom", message: "At most 100%", path: ["discountValue"] })
      if (!data.discountReason) ctx.addIssue({ code: "custom", message: "Say why the discount is given", path: ["discountReason"] })
    }
  })

// What the review step prices: no customer, since it doesn't change the price
export const previewQuoteSchema = z.object({
  // The store making it from its own listings; null on the platform's pages
  storeId: z.uuid().nullable().default(null),
  // A member of a store can only give the account's own trade discount, so it's checked against this
  customerUserId: z.uuid().nullable().default(null),
  items: z.array(quoteItemInputSchema).min(1).max(50),
  shippingRegion: z.string(),
  shippingTown: z.string(),
  shippingGhs: decimalSchema,
  ...discountFields,
})

export const findQuoteCustomerSchema = z.object({
  // The store making it from its own listings; null on the platform's pages
  storeId: z.uuid().nullable().default(null),
  // An exact email or phone number: staff can't browse the platform's customers
  email: z
    .string()
    .trim()
    .refine((value) => !value || z.email().safeParse(value).success, "Invalid email address"),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || isPossiblePhoneNumber(value), "Invalid phone number"),
})

export const searchQuotableItemsSchema = z.object({
  // The store making it from its own listings; null on the platform's pages
  storeId: z.uuid().nullable().default(null),
  search: z.string().trim().max(100),
})

export const quoteTargetSchema = z.object({
  // The store making it from its own listings; null on the platform's pages
  storeId: z.uuid().nullable().default(null),
  quoteId: z.uuid("Invalid quotation ID"),
})

// "Place order" on a quote whose delivery was to be confirmed: the fee agreed with the customer, in GHS
export const quoteDeliveryFormSchema = z.object({
  deliveryGhs: z
    .union([decimalSchema, z.literal("")])
    .refine((value) => value !== "", "Enter the delivery fee, or 0 for free delivery")
    .transform((value) => value as number),
})
export const placeOrderFromQuoteSchema = quoteTargetSchema.extend({ deliveryGhs: decimalSchema.optional() })
