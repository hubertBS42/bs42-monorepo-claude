"use server"
import { z } from "zod"
import { addProductFormSchema } from "@/lib/schemas/product.schemas"
import { generateUniqueSku, prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { Status } from "@workspace/db/enums"
import { formatError } from "@workspace/auth/format-error"
import { ActionResponse } from "@workspace/contracts"
import { isManagedFileUrl } from "@workspace/storage"
import { sanitizeRichText } from "@workspace/utils/rich-text"
import { requireSystemPermission } from "@/lib/auth-guard"

// Every export here is a public endpoint, so every input is validated

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const INVALID_FILE: ActionResponse = { success: false, error: "Invalid file URL.", code: "INVALID_FILE" }
const BRAND_UNAVAILABLE: ActionResponse = { success: false, error: "The brand no longer exists or is archived.", code: "INVALID_BRAND" }
const CATEGORY_UNAVAILABLE: ActionResponse = { success: false, error: "The category no longer exists or is archived.", code: "INVALID_CATEGORY" }
const CATEGORY_NOT_LEAF: ActionResponse = { success: false, error: "Choose a category without subcategories.", code: "INVALID_CATEGORY" }
const SKU_EXISTS: ActionResponse = { success: false, error: "A product or variant already uses this SKU.", code: "SKU_EXISTS" }
const BARCODE_EXISTS: ActionResponse = { success: false, error: "A product or variant already uses this barcode.", code: "BARCODE_EXISTS" }

// Products and variants each have their own unique column, so a SKU or barcode is checked against both
async function isTaken(field: "sku" | "barcode", values: string[]) {
  if (values.length === 0) return false
  const where = field === "sku" ? { sku: { in: values } } : { barcode: { in: values } }
  const [product, variant] = await Promise.all([prisma.product.findFirst({ where, select: { id: true } }), prisma.productVariant.findFirst({ where, select: { id: true } })])
  return !!(product || variant)
}

// Slug and option conflicts are handled before they get here, so a unique violation is a SKU or barcode saved in the meantime
function getUniqueConflict(error: unknown): ActionResponse | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return undefined
  const meta = JSON.stringify(error.meta ?? {}).toLowerCase()
  if (meta.includes("sku")) return SKU_EXISTS
  if (meta.includes("barcode")) return BARCODE_EXISTS
  return undefined
}

export async function createProductAction(input: z.input<typeof addProductFormSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ product: ["create"] })

  try {
    const parsed = addProductFormSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)

    const { documents, variantOptions = [], variants = [], sku, barcode, weight, dimensions, banner, ...fields } = parsed.data

    // The client could send any URL, so only accept blobs in our own container
    const fileUrls = [...fields.images, ...(banner ? [banner] : []), ...documents.map((document) => document.url), ...variants.flatMap((variant) => variant.images)]
    if (!fileUrls.every(isManagedFileUrl)) return INVALID_FILE

    const [brand, category] = await Promise.all([
      prisma.brand.findUnique({ where: { id: fields.brandId }, select: { status: true } }),
      prisma.category.findUnique({ where: { id: fields.categoryId }, select: { status: true, _count: { select: { childCategories: true } } } }),
    ])
    if (!brand || brand.status === Status.ARCHIVED) return BRAND_UNAVAILABLE
    if (!category || category.status === Status.ARCHIVED) return CATEGORY_UNAVAILABLE
    // Products only go in the most specific category, so a branch like "Men" never lists them next to "Men › Shoes"
    if (category._count.childCategories > 0) return CATEGORY_NOT_LEAF

    // A product with variants keeps its SKU, barcode and shipping details per variant
    const chosenSkus = (fields.hasVariants ? variants.map((variant) => variant.sku) : [sku]).filter((value): value is string => !!value)
    const chosenBarcodes = (fields.hasVariants ? variants.map((variant) => variant.barcode) : [barcode]).filter((value): value is string => !!value)
    if (await isTaken("sku", chosenSkus)) return SKU_EXISTS
    if (await isTaken("barcode", chosenBarcodes)) return BARCODE_EXISTS

    await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.create({
          data: {
            ...fields,
            // Editor JSON the storefront renders, and the client could send anything
            description: sanitizeRichText(fields.description),
            // Placeholder: the Prisma hook generates the real slug, and a SKU for a simple product left without one
            slug: "",
            banner: banner || null,
            ...(!fields.hasVariants && { sku: sku || null, barcode: barcode || null, weight: weight ?? null, dimensions: dimensions || null }),
            documents: { create: documents.map(({ name, url }) => ({ name, url })) },
            variantOptions: {
              create: variantOptions.map((option) => ({
                name: option.name,
                position: option.position,
                values: { create: option.values.map(({ value, position }) => ({ value, position })) },
              })),
            },
          },
          select: { id: true, name: true, variantOptions: { select: { name: true, values: { select: { id: true, value: true } } } } },
        })

        // Matched by name and value rather than position: Prisma doesn't promise the order created rows come back in
        const valueIds = new Map(product.variantOptions.flatMap((option) => option.values.map((value) => [`${option.name}\u0000${value.value}`, value.id])))

        // One at a time: tx sees the variants created before this one, so their SKUs count as taken
        for (const variant of variants) {
          const optionValueIds = Object.entries(variant.attributes).map(([option, value]) => {
            const id = valueIds.get(`${option}\u0000${value}`)
            // The schema checks every attribute against the options, so this only happens if the two disagree
            if (!id) throw new Error(`Unknown option value ${option}: ${value}`)
            return id
          })

          await tx.productVariant.create({
            data: {
              productId: product.id,
              sku: variant.sku || (await generateUniqueSku(tx, product.name)),
              barcode: variant.barcode || null,
              images: variant.images,
              weight: variant.weight ?? null,
              dimensions: variant.dimensions || null,
              position: variant.position,
              variantValues: { create: optionValueIds.map((optionValueId) => ({ optionValueId })) },
            },
          })
        }
      },
      // The remote database is slow enough that the 5 s default runs out for a product with many variants
      { maxWait: 10_000, timeout: 30_000 }
    )

    return { success: true }
  } catch (error) {
    const conflict = getUniqueConflict(error)
    if (conflict) return conflict
    return { success: false, error: formatError(error) }
  }
}
