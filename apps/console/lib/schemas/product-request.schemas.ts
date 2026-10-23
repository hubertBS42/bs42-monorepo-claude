import z from "zod"
import { optionalHttpUrl } from "./common.schemas"

// Stores asking for products the catalogue doesn't have, and platform admins answering

export const PRODUCT_REQUEST_LIMITS = { name: 150, brandName: 100, barcode: 64, notes: 1000, reason: 500 } as const

// null in as well as out, so the form's fields can hold what the schema gives back
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .nullable()
    .transform((value) => value || null)

// The brand select's choice for a brand the catalogue doesn't have yet
export const NEW_BRAND = "new"

// "" for a select left empty, so the form can hold it, or null for a cleared cascader
const optionalId = z.union([z.uuid(), z.literal(""), z.null()]).transform((value) => value || null)

export const productRequestFormSchema = z.object({
  name: z.string().trim().min(1, "Enter the product's name").max(PRODUCT_REQUEST_LIMITS.name, `At most ${PRODUCT_REQUEST_LIMITS.name} characters`),
  // An existing brand, or NEW_BRAND (or nothing) with the name of one the catalogue doesn't have
  brandId: z.union([z.uuid(), z.literal(""), z.literal(NEW_BRAND), z.null()]).transform((value) => (value === NEW_BRAND ? "" : value) || null),
  brandName: optionalText(PRODUCT_REQUEST_LIMITS.brandName),
  categoryId: optionalId,
  barcode: optionalText(PRODUCT_REQUEST_LIMITS.barcode),
  link: optionalHttpUrl("Enter a web address starting with http:// or https://"),
  notes: optionalText(PRODUCT_REQUEST_LIMITS.notes),
})

export const createProductRequestSchema = productRequestFormSchema.extend({ storeId: z.uuid("Invalid store ID") })

export const cancelProductRequestSchema = z.object({ storeId: z.uuid("Invalid store ID"), requestId: z.uuid("Invalid request ID") })

// What the store has typed so far, to find catalogue products it may mean
export const findCatalogueMatchesSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
  name: z.string().trim().max(PRODUCT_REQUEST_LIMITS.name),
  barcode: z.string().trim().max(PRODUCT_REQUEST_LIMITS.barcode),
})

export const declineProductRequestFormSchema = z.object({
  reason: z.string().trim().min(1, "Tell the store why").max(PRODUCT_REQUEST_LIMITS.reason, `At most ${PRODUCT_REQUEST_LIMITS.reason} characters`),
})

export const declineProductRequestSchema = declineProductRequestFormSchema.extend({ requestId: z.uuid("Invalid request ID") })

export const matchProductRequestFormSchema = z.object({ productId: z.uuid("Choose the product") })

export const matchProductRequestSchema = matchProductRequestFormSchema.extend({ requestId: z.uuid("Invalid request ID") })

export const searchCatalogueSchema = z.object({ search: z.string().trim().min(1).max(100) })
