import z from "zod"
import { Currency, PurchaseOrderStatus } from "@workspace/db/enums"
import { decimalSchema } from "@/lib/schemas/product.schemas"

// A line as the form sends it. A saved line keeps its id (and its listing); a new one has none.
export const purchaseOrderLineSchema = z.object({
  id: z.uuid().optional(),
  listingId: z.uuid(),
  listingVariantId: z.uuid().nullable(),
  quantity: z.number("Enter a quantity").int("Enter a whole number").min(1, "At least 1").max(99_999, "At most 99,999"),
  unitCost: decimalSchema,
})

export const purchaseOrderFormSchema = z.object({
  supplierId: z.uuid("Choose a supplier"),
  currency: z.enum(Currency),
  shippingCost: decimalSchema,
  // A plain day (yyyy-MM-dd), or none
  expectedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .nullable(),
  // Null is accepted too, so the form's output can be sent to the action as it is
  notes: z
    .string()
    .trim()
    .max(2000, "Keep the notes under 2,000 characters")
    .transform((value) => value || null)
    .nullable(),
  lines: z
    .array(purchaseOrderLineSchema)
    .min(1, "Add at least one item")
    .max(200, "At most 200 items")
    .refine((lines) => new Set(lines.map((line) => `${line.listingId}:${line.listingVariantId ?? ""}`)).size === lines.length, "Each item can only be on the order once"),
})

// The form's values: the date field holds a Date, sent as a plain day
export const purchaseOrderFormValuesSchema = purchaseOrderFormSchema.extend({
  expectedOn: z.date().nullable(),
})

export const createPurchaseOrderSchema = purchaseOrderFormSchema.extend({
  storeId: z.uuid("Invalid store ID"),
})

// version is the updatedAt the form loaded (ISO), so a save from a stale form is refused
export const updatePurchaseOrderSchema = createPurchaseOrderSchema.extend({
  id: z.uuid("Invalid purchase order ID"),
  version: z.iso.datetime(),
})

export const purchaseOrderRefSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
  id: z.uuid("Invalid purchase order ID"),
})

export const receivePurchaseOrderFormSchema = z.object({
  items: z.array(z.object({ purchaseOrderItemId: z.uuid(), quantity: z.number("Enter a quantity").int("Enter a whole number").min(0, "Can't be negative") })),
  updateBuyPrices: z.boolean(),
  note: z
    .string()
    .trim()
    .max(1000, "Keep the note under 1,000 characters")
    .transform((value) => value || null)
    .nullable(),
})

export const receivePurchaseOrderSchema = receivePurchaseOrderFormSchema.extend({
  ...purchaseOrderRefSchema.shape,
  // How many deliveries the page showed
  receiptCount: z.number().int().min(0),
})

export const cancelPurchaseOrderFormSchema = z.object({
  reason: z.string().trim().min(1, "Give a reason").max(1000, "Keep the reason under 1,000 characters"),
})

export const cancelPurchaseOrderSchema = cancelPurchaseOrderFormSchema.extend({
  ...purchaseOrderRefSchema.shape,
  currentStatus: z.enum(PurchaseOrderStatus),
})

export const searchPurchasableListingsSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
  search: z.string().trim().max(100),
})
