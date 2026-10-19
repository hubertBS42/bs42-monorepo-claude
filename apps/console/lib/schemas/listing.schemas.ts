import { z } from "zod"
import { Status, StockMovementReason } from "@workspace/db/enums"
import { decimalSchema, optionalDecimalSchema } from "@/lib/schemas/product.schemas"
import { MANUAL_STOCK_REASONS } from "@/lib/stock-reasons"

const quantitySchema = z.number("Enter a whole number").int("Enter a whole number").min(0, "Can't be negative")

// A store's price and stock for one of the product's variants. A variant without its own sell price
// sells at the listing's price. Tracking and the low stock alert follow the listing.
export const listingVariantSchema = z.object({
  variantId: z.uuid(),
  sellPrice: optionalDecimalSchema,
  stock: quantitySchema,
  status: z.enum(Status),
})

// Prices are USD, like the catalogue's
export const listingFormSchema = z
  .object({
    sellPrice: decimalSchema,
    buyPrice: optionalDecimalSchema,
    compareAtPrice: optionalDecimalSchema,
    // Only used for a product without variants; each variant has its own
    stock: quantitySchema,
    lowStockThreshold: quantitySchema,
    trackInventory: z.boolean(),
    isFeatured: z.boolean(),
    status: z.enum(Status),
    variants: z.array(listingVariantSchema),
    // Why stock was changed by hand, for the stock history. An edit that changes stock must give one (the action
    // checks, since only it knows what was saved); a new listing's stock is its initial stock.
    stockReason: z.enum(MANUAL_STOCK_REASONS).nullable(),
    // Null is accepted too, so the form's output can be sent to the action as it is
    stockNote: z
      .string()
      .trim()
      .max(500, "Keep the note under 500 characters")
      .transform((value) => value || null)
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.stockReason === StockMovementReason.OTHER && !data.stockNote) {
      ctx.addIssue({ code: "custom", message: "Say what happened", path: ["stockNote"] })
    }
    // Drafts can be saved before the price is known, but nothing goes on sale for free by accident
    if (data.status === Status.PUBLISHED && data.sellPrice <= 0) {
      ctx.addIssue({ code: "custom", message: "A published listing needs a sell price above 0", path: ["sellPrice"] })
    }
    if (data.compareAtPrice != null && data.compareAtPrice <= data.sellPrice) {
      ctx.addIssue({ code: "custom", message: "The compare-at price must be higher than the sell price", path: ["compareAtPrice"] })
    }
    data.variants.forEach((variant, index) => {
      if (data.status === Status.PUBLISHED && variant.status === Status.PUBLISHED && variant.sellPrice === 0) {
        ctx.addIssue({ code: "custom", message: "Above 0, or empty to use the listing price", path: ["variants", index, "sellPrice"] })
      }
    })
  })

// The values a form loaded, as the loader sends them: what the edit form starts from, and what it sends back
// as `original` so the action can tell the user's changes from changes made elsewhere while the form was open
export const listingSnapshotSchema = z.object({
  sellPrice: z.number(),
  buyPrice: z.number().nullable(),
  compareAtPrice: z.number().nullable(),
  stock: z.number().int(),
  lowStockThreshold: z.number().int(),
  trackInventory: z.boolean(),
  isFeatured: z.boolean(),
  status: z.enum(Status),
  variants: z.array(z.object({ variantId: z.uuid(), sellPrice: z.number().nullable(), stock: z.number().int(), status: z.enum(Status) })),
})

// The store comes from the page, so a listing can't land in a store the user switched to in another tab
export const createListingSchema = listingFormSchema.extend({
  storeId: z.uuid("Invalid store ID"),
  productId: z.uuid("Invalid product ID"),
})

export const updateListingSchema = listingFormSchema.extend({
  id: z.uuid("Invalid listing ID"),
  storeId: z.uuid("Invalid store ID"),
  original: listingSnapshotSchema,
})
