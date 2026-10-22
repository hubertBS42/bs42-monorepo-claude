import { z } from "zod"
import { Condition, InstallationOption, Status } from "@workspace/db/enums"

// Helper schema for decimal validation. Also used by listings, which hold store prices.
export const decimalSchema = z
  .number("Enter a numeric value")
  .min(0, { message: "Amount must be zero or positive" })
  // Compared with a tolerance: 0.29 * 100 is 28.999999999999996 in floating point
  .refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, { message: "Amount cannot have more than two decimal places" })
// A cleared number field sends "", which means no value rather than an invalid one
export const optionalDecimalSchema = z
  .union([decimalSchema, z.literal("").transform(() => null)])
  .nullable()
  .optional()

// ============================================
// VARIANT OPTION SCHEMAS
// ============================================

export const variantOptionValueSchema = z.object({
  id: z.uuid().optional(),
  value: z.string().min(1, "Value is required"),
  position: z.number().int(),
})

export const variantOptionSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().min(1, "Option name is required"),
  position: z.number().int(),
  values: z.array(variantOptionValueSchema).min(1, "At least one value is required"),
})

// ============================================
// VARIANT SCHEMA
// ============================================

export const productVariantSchema = z.object({
  id: z.uuid().optional(),
  sku: z.string().nullable().optional().or(z.literal("")),
  barcode: z.string().nullable().optional(),
  images: z.array(z.httpUrl("Invalid image URL")),
  weight: optionalDecimalSchema,
  dimensions: z.string().nullable().optional(),
  position: z.number().int(),
  attributes: z.record(z.string(), z.string()).refine((attrs) => Object.keys(attrs).length > 0, {
    message: "At least one attribute is required",
  }),
})

export const productDocumentSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().min(1, "Document name is required"),
  url: z.httpUrl("Invalid document URL"),
})

// ============================================
// MAIN PRODUCT FORM SCHEMA
// ============================================

export const addProductFormSchema = z
  .object({
    name: z.string().min(1, "You must provide a product name.").min(3, "Product name must be at least 3 characters."),
    brandId: z.uuid("You must provide a valid product brand."),
    baseSellPrice: decimalSchema,
    baseBuyPrice: decimalSchema,
    categoryId: z.uuid("Select a category"),
    hasVariants: z.boolean(),
    condition: z.enum(Condition),
    // Installing one unit: the category's fee, its own (GHS), or not offered. The fee only counts for OWN.
    installation: z.enum(InstallationOption),
    installationFeeGhs: optionalDecimalSchema,
    // Editor JSON, so the limit is on the document rather than the visible text
    description: z.string().max(200_000, "The description is too long.").nullable(),
    images: z.array(z.httpUrl("Invalid image URL")).min(1, "You must provide at least one image."),
    status: z.enum(Status),
    banner: z.httpUrl("Invalid URL").optional().or(z.literal("")),
    tags: z.array(z.string()),
    documents: z.array(productDocumentSchema),
    // Values for the category's specs, by spec id: an option id, "true"/"false", text or a number ("" when not set).
    // The action checks them against the specs (lib/product-specs.ts).
    specs: z.record(z.string(), z.union([z.string().max(200, "At most 200 characters"), z.number()])),

    // Simple product fields (only when hasVariants is false)
    sku: z.string().nullable().optional().or(z.literal("")),
    barcode: z.string().nullable().optional().or(z.literal("")),
    dimensions: z.string().nullable().optional().or(z.literal("")),
    weight: optionalDecimalSchema,

    // Variant-related fields (only required if hasVariants is true)
    variantOptions: z.array(variantOptionSchema).optional(),
    variants: z.array(productVariantSchema).optional(),
  })
  .superRefine((data, ctx) => {
    // Drafts can be saved before the price is known, but nothing goes on sale for free by accident
    if (data.status === Status.PUBLISHED && data.baseSellPrice <= 0) {
      ctx.addIssue({ code: "custom", message: "A published product needs a sell price above 0", path: ["baseSellPrice"] })
    }
    if (data.installation === InstallationOption.OWN && !data.installationFeeGhs) {
      ctx.addIssue({ code: "custom", message: "Enter the fee for installing one", path: ["installationFeeGhs"] })
    }

    // ============================================
    // VALIDATION FOR PRODUCTS WITHOUT VARIANTS
    // ============================================
    if (!data.hasVariants) {
      if (data.variantOptions && data.variantOptions.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: "Variant options should not be provided when hasVariants is false",
          path: ["variantOptions"],
        })
      }

      if (data.variants && data.variants.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: "Variants should not be provided when hasVariants is false",
          path: ["variants"],
        })
      }
    }

    // ============================================
    // VALIDATION FOR PRODUCTS WITH VARIANTS
    // ============================================
    if (data.hasVariants) {
      if (!data.variantOptions || data.variantOptions.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "At least one variant option is required when hasVariants is true",
          path: ["variantOptions"],
        })
      }

      if (!data.variants || data.variants.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "At least one variant is required when hasVariants is true",
          path: ["variants"],
        })
      }

      if (data.variantOptions && data.variants) {
        // Option names and values are unique per product and option, and "Size" next to "size" would only confuse
        const optionValues = new Map<string, Set<string>>()
        data.variantOptions.forEach((option, optionIdx) => {
          if ([...optionValues.keys()].some((name) => name.toLowerCase() === option.name.toLowerCase())) {
            ctx.addIssue({ code: "custom", message: `Option "${option.name}" is listed twice`, path: ["variantOptions", optionIdx, "name"] })
          }

          const values = new Set<string>()
          option.values.forEach((value, valueIdx) => {
            if ([...values].some((existing) => existing.toLowerCase() === value.value.toLowerCase())) {
              ctx.addIssue({ code: "custom", message: `Value "${value.value}" is listed twice`, path: ["variantOptions", optionIdx, "values", valueIdx, "value"] })
            }
            values.add(value.value)
          })
          optionValues.set(option.name, values)
        })

        const combinations = new Set<string>()
        const skus = new Set<string>()
        const barcodes = new Set<string>()

        data.variants.forEach((variant, variantIdx) => {
          const variantAttrKeys = Object.keys(variant.attributes)

          variantAttrKeys.forEach((attrKey) => {
            const values = optionValues.get(attrKey)
            if (!values) {
              ctx.addIssue({
                code: "custom",
                message: `Attribute "${attrKey}" is not defined in variant options`,
                path: ["variants", variantIdx, "attributes", attrKey],
              })
            } else if (!values.has(variant.attributes[attrKey]!)) {
              ctx.addIssue({
                code: "custom",
                message: `"${variant.attributes[attrKey]}" is not a value of ${attrKey}`,
                path: ["variants", variantIdx, "attributes", attrKey],
              })
            }
          })

          optionValues.forEach((_, optionName) => {
            if (!variantAttrKeys.includes(optionName)) {
              ctx.addIssue({
                code: "custom",
                message: `Missing required attribute "${optionName}"`,
                path: ["variants", variantIdx, "attributes"],
              })
            }
          })

          const combination = [...optionValues.keys()].map((optionName) => variant.attributes[optionName]).join("\u0000")
          if (combinations.has(combination)) {
            ctx.addIssue({ code: "custom", message: "Another variant has the same attributes", path: ["variants", variantIdx, "attributes"] })
          }
          combinations.add(combination)

          if (variant.sku) {
            if (skus.has(variant.sku)) ctx.addIssue({ code: "custom", message: "Another variant has this SKU", path: ["variants", variantIdx, "sku"] })
            skus.add(variant.sku)
          }
          if (variant.barcode) {
            if (barcodes.has(variant.barcode)) ctx.addIssue({ code: "custom", message: "Another variant has this barcode", path: ["variants", variantIdx, "barcode"] })
            barcodes.add(variant.barcode)
          }
        })
      }
    }
  })

export const updateProductFormSchema = addProductFormSchema.extend({
  id: z.uuid("ID is required"),
})
