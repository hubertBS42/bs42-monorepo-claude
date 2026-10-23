"use server"
import { after } from "next/server"
import { z } from "zod"
import { addProductFormSchema, moveProductsSchema, setProductsStatusSchema, updateProductFormSchema } from "@/lib/schemas/product.schemas"
import { generateUniqueSku, prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { InstallationOption, ProductRequestStatus, Status } from "@workspace/db/enums"
import { formatError } from "@workspace/auth/format-error"
import { notifyProductRequestDecision } from "@workspace/commerce/notifications"
import { ActionResponse } from "@workspace/contracts"
import { isManagedFileUrl, removeFiles } from "@workspace/storage"
import { sanitizeRichText } from "@workspace/utils/rich-text"
import { requireSystemPermission } from "@/lib/auth-guard"
import { loadProductForUpdate, syncProduct } from "@/lib/product-sync"
import { getCategoryChain, saveProductSpecs, SpecValueError } from "@/lib/product-specs"

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
const NOT_FOUND: ActionResponse = { success: false, error: "Product not found.", code: "NOT_FOUND" }
const HAS_ORDERS: ActionResponse = { success: false, error: "This product has been ordered or bought in by a store, so it can't be deleted. Archive it instead.", code: "HAS_ORDERS" }

const productIdSchema = z.uuid("Invalid product ID")

// The remote database is slow enough that the 5 s default runs out for a product with many variants
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

// Products and variants each have their own unique column, so a SKU or barcode is checked against both.
// An edited product's own rows don't count: its variants keep their codes.
async function isTaken(field: "sku" | "barcode", values: string[], ownProductId?: string) {
  if (values.length === 0) return false
  const where = field === "sku" ? { sku: { in: values } } : { barcode: { in: values } }
  const [product, variant] = await Promise.all([
    prisma.product.findFirst({ where: { ...where, ...(ownProductId && { id: { not: ownProductId } }) }, select: { id: true } }),
    prisma.productVariant.findFirst({ where: { ...where, ...(ownProductId && { productId: { not: ownProductId } }) }, select: { id: true } }),
  ])
  return !!(product || variant)
}

type ProductInput = z.output<typeof addProductFormSchema>

// What both create and update check before writing anything
async function checkProductInput(data: ProductInput, ownProductId?: string): Promise<ActionResponse | undefined> {
  const { documents, variants = [], sku, barcode, banner, images, brandId, categoryId, hasVariants } = data

  // The client could send any URL, so only accept blobs in our own container
  const fileUrls = [...images, ...(banner ? [banner] : []), ...documents.map((document) => document.url), ...variants.flatMap((variant) => variant.images)]
  if (!fileUrls.every(isManagedFileUrl)) return INVALID_FILE

  const [brand, category] = await Promise.all([
    prisma.brand.findUnique({ where: { id: brandId }, select: { status: true } }),
    prisma.category.findUnique({ where: { id: categoryId }, select: { status: true, _count: { select: { childCategories: true } } } }),
  ])
  if (!brand || brand.status === Status.ARCHIVED) return BRAND_UNAVAILABLE
  if (!category || category.status === Status.ARCHIVED) return CATEGORY_UNAVAILABLE
  // Products only go in the most specific category, so a branch like "Men" never lists them next to "Men › Shoes"
  if (category._count.childCategories > 0) return CATEGORY_NOT_LEAF

  // A product with variants keeps its SKU, barcode and shipping details per variant
  const chosenSkus = (hasVariants ? variants.map((variant) => variant.sku) : [sku]).filter((value): value is string => !!value)
  const chosenBarcodes = (hasVariants ? variants.map((variant) => variant.barcode) : [barcode]).filter((value): value is string => !!value)
  if (await isTaken("sku", chosenSkus, ownProductId)) return SKU_EXISTS
  if (await isTaken("barcode", chosenBarcodes, ownProductId)) return BARCODE_EXISTS

  return undefined
}

// A spec value that doesn't fit its spec, e.g. an option removed since the page loaded
function getSpecProblem(error: unknown): ActionResponse | undefined {
  return error instanceof SpecValueError ? { success: false, error: error.message, code: "INVALID_SPEC" } : undefined
}

// Slug and option conflicts are handled before they get here, so a unique violation is a SKU or barcode saved in the meantime
function getUniqueConflict(error: unknown): ActionResponse | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return undefined
  const meta = JSON.stringify(error.meta ?? {}).toLowerCase()
  if (meta.includes("sku")) return SKU_EXISTS
  if (meta.includes("barcode")) return BARCODE_EXISTS
  return undefined
}

// requestId: a store's request the product answers, which it marks as done (and tells the store) while it's still
// pending. One dealt with in the meantime doesn't stop the product being made.
export async function createProductAction(input: z.input<typeof addProductFormSchema>, requestId?: string): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  const { user } = await requireSystemPermission({ product: ["create"] })

  try {
    const parsed = addProductFormSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    if (requestId !== undefined && !z.uuid().safeParse(requestId).success) return { success: false, error: "Invalid request ID", code: "INVALID" }

    const problem = await checkProductInput(parsed.data)
    if (problem) return problem

    const { documents, variantOptions = [], variants = [], sku, barcode, weight, dimensions, banner, specs, ...fields } = parsed.data

    const answered = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...fields,
          // Editor JSON the storefront renders, and the client could send anything
          description: sanitizeRichText(fields.description),
          // Placeholder: the Prisma hook generates the real slug, and a SKU for a simple product left without one
          slug: "",
          banner: banner || null,
          installationFeeGhs: fields.installation === InstallationOption.OWN ? fields.installationFeeGhs : null,
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

      await saveProductSpecs(tx, product.id, fields.categoryId, specs)

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

      if (!requestId) return false
      const { count } = await tx.productRequest.updateMany({
        where: { id: requestId, status: ProductRequestStatus.PENDING },
        data: { status: ProductRequestStatus.CREATED, productId: product.id, reviewedById: user.id, reviewedAt: new Date() },
      })
      return count > 0
    }, TRANSACTION_OPTIONS)

    if (answered && requestId) after(() => notifyProductRequestDecision(requestId))
    return { success: true }
  } catch (error) {
    const conflict = getUniqueConflict(error) ?? getSpecProblem(error)
    if (conflict) return conflict
    return { success: false, error: formatError(error) }
  }
}

export async function updateProductAction(input: z.input<typeof updateProductFormSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ product: ["update"] })

  try {
    const parsed = updateProductFormSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)

    const saved = await loadProductForUpdate(parsed.data.id)
    if (!saved) return NOT_FOUND

    const problem = await checkProductInput(parsed.data, parsed.data.id)
    if (problem) return problem

    const { specs, ...data } = parsed.data
    const unusedFiles = await prisma.$transaction(async (tx) => {
      // Editor JSON the storefront renders, and the client could send anything
      const unused = await syncProduct(tx, saved, { ...data, description: sanitizeRichText(data.description) })
      await saveProductSpecs(tx, data.id, data.categoryId, specs)
      return unused
    }, TRANSACTION_OPTIONS)

    // Only the server knows which files were saved, so it removes the replaced ones once the update has committed
    await removeFiles(unusedFiles)
    return { success: true }
  } catch (error) {
    const conflict = getUniqueConflict(error) ?? getSpecProblem(error)
    if (conflict) return conflict
    return { success: false, error: formatError(error) }
  }
}

export async function deleteProductAction(productId: string): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ product: ["delete"] })

  try {
    if (!productIdSchema.safeParse(productId).success) return NOT_FOUND

    // Order lines restrict deleting the product, its variants and store listings of either, so check them all first
    const ordered = await prisma.orderItem.findFirst({
      where: { OR: [{ productId }, { productVariant: { productId } }, { storeListing: { productId } }] },
      select: { id: true },
    })
    if (ordered) return HAS_ORDERS
    // So do stores' purchase order lines, through their listings
    if (await prisma.purchaseOrderItem.findFirst({ where: { storeListing: { productId } }, select: { id: true } })) return HAS_ORDERS

    // Variants, documents and store listings cascade; the Prisma hook removes the files once the delete commits
    await prisma.product.delete({ where: { id: productId } })
    return { success: true }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return NOT_FOUND
      // Ordered between the check and the delete
      if (error.code === "P2003") return HAS_ORDERS
    }
    return { success: false, error: formatError(error) }
  }
}

// The products table's bulk actions, for the products ticked on one page

// How many products a refusal names before "and N more"
const NAMES_SHOWN = 5

const nameList = (names: string[]) => (names.length > NAMES_SHOWN ? `${names.slice(0, NAMES_SHOWN).join(", ")} and ${names.length - NAMES_SHOWN} more` : names.join(", "))

// All or none: publishing refuses, naming them, while any ticked product has no sell price
export async function setProductsStatusAction(input: z.input<typeof setProductsStatusSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ product: ["update"] })

  try {
    const parsed = setProductsStatusSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { productIds, status } = parsed.data

    if (status === Status.PUBLISHED) {
      const unpriced = await prisma.product.findMany({ where: { id: { in: productIds }, baseSellPrice: { lte: 0 } }, select: { name: true }, orderBy: { name: "asc" } })
      if (unpriced.length) {
        return {
          success: false,
          error: `A published product needs a sell price above 0. Set one for ${nameList(unpriced.map((product) => product.name))}, or untick ${unpriced.length === 1 ? "it" : "them"}.`,
          code: "NO_PRICE",
        }
      }
    }

    // The price condition again, in case one was set to 0 since the check
    await prisma.product.updateMany({ where: { id: { in: productIds }, ...(status === Status.PUBLISHED && { baseSellPrice: { gt: 0 } }) }, data: { status } })
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Moving clears the products' values for specs the new category doesn't have, as saving the product form does
export async function moveProductsAction(input: z.input<typeof moveProductsSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ product: ["update"] })

  try {
    const parsed = moveProductsSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { productIds, categoryId } = parsed.data

    const categories = await prisma.category.findMany({ select: { id: true, parentId: true, status: true } })
    const category = categories.find((row) => row.id === categoryId)
    if (!category || category.status === Status.ARCHIVED) return CATEGORY_UNAVAILABLE
    if (categories.some((row) => row.parentId === categoryId)) return CATEGORY_NOT_LEAF
    // Specs apply to their category and every category under it
    const specCategoryIds = getCategoryChain(categories, categoryId)

    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({ where: { id: { in: productIds } }, data: { categoryId } })
      await tx.productSpecValue.deleteMany({ where: { productId: { in: productIds }, spec: { categoryId: { notIn: specCategoryIds } } } })
    }, TRANSACTION_OPTIONS)
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
