"use server"
import { z } from "zod"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { Status, StockMovementReason } from "@workspace/db/enums"
import { formatError } from "@workspace/auth/format-error"
import { ActionResponse } from "@workspace/contracts"
import { hasStorePermission, requireConsoleAccess } from "@/lib/auth-guard"
import { ListingConflictError, ListingNotFoundError, StockChangedError, StockReasonRequiredError, syncListing } from "@/lib/listing-sync"
import { createListingSchema, updateListingSchema } from "@/lib/schemas/listing.schemas"
import { recordStockMovement } from "@workspace/commerce/stock-movements"
import type { StockChangedResponse } from "@/types"

// Every export here is a public endpoint, so every input is validated, and each one calls requireConsoleAccess
// before its try block (its redirect throws, which the catch would swallow). The store comes from the page and
// the caller's role in it is checked here: listings are written with Prisma, not through Better Auth.

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const FORBIDDEN: ActionResponse = { success: false, error: "Your role in this store can't do this.", code: "FORBIDDEN" }
const NOT_FOUND: ActionResponse = { success: false, error: "This listing no longer exists. Refresh the page.", code: "NOT_FOUND" }
const PRODUCT_UNAVAILABLE: ActionResponse = { success: false, error: "This product is no longer published in the catalogue.", code: "PRODUCT_UNAVAILABLE" }
const ALREADY_LISTED: ActionResponse = { success: false, error: "This store already lists this product.", code: "ALREADY_LISTED" }
const VARIANTS_CHANGED: ActionResponse = { success: false, error: "The product's variants have changed. Refresh the page to see them.", code: "VARIANTS_CHANGED" }
const CONFLICT: ActionResponse = {
  success: false,
  error: "Someone else changed this listing while you were editing. Refresh the page to see their changes, then make yours again.",
  code: "CONFLICT",
}
const STOCK_REASON_REQUIRED: ActionResponse = { success: false, error: "Choose why the stock changed.", code: "STOCK_REASON_REQUIRED" }
const HAS_ORDERS: ActionResponse = { success: false, error: "This listing has been ordered or bought in, so it can't be deleted. Archive it instead.", code: "HAS_ORDERS" }

const deleteListingSchema = z.object({ id: z.uuid("Invalid listing ID"), storeId: z.uuid("Invalid store ID") })

// The remote database is slow enough that the 5 s default runs out for a product with many variants
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

// The form lists the product's variants that aren't archived, so the submitted ones must be exactly those.
// Anything else means the product was edited after the form loaded.
async function hasCurrentVariants(productId: string, hasVariants: boolean, submitted: { variantId: string }[]) {
  if (!hasVariants) return submitted.length === 0
  const variants = await prisma.productVariant.findMany({ where: { productId, status: { not: Status.ARCHIVED } }, select: { id: true } })
  const ids = new Set(variants.map((variant) => variant.id))
  const submittedIds = new Set(submitted.map((variant) => variant.variantId))
  return submittedIds.size === submitted.length && submittedIds.size === ids.size && [...submittedIds].every((id) => ids.has(id))
}

function mapWriteError(error: unknown): ActionResponse | undefined {
  if (error instanceof ListingConflictError) return CONFLICT
  if (error instanceof StockReasonRequiredError) return STOCK_REASON_REQUIRED
  if (error instanceof ListingNotFoundError) return NOT_FOUND
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return undefined
  if (error.code === "P2002") return ALREADY_LISTED
  // A variant deleted from the catalogue between the check and the write
  if (error.code === "P2003") return VARIANTS_CHANGED
  if (error.code === "P2025") return NOT_FOUND
  return undefined
}

export async function createListingAction(input: z.input<typeof createListingSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = createListingSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, productId, variants, sellPrice, buyPrice, compareAtPrice, stock, lowStockThreshold, trackInventory, isFeatured, status } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { listing: ["create"] }))) return FORBIDDEN

    const product = await prisma.product.findFirst({ where: { id: productId, status: Status.PUBLISHED }, select: { hasVariants: true } })
    if (!product) return PRODUCT_UNAVAILABLE
    if (!(await hasCurrentVariants(productId, product.hasVariants, variants))) return VARIANTS_CHANGED

    // The listing with its variants, and the stock history's first entries: their initial stock
    await prisma.$transaction(async (tx) => {
      const listing = await tx.storeListing.create({
        select: { id: true, stock: true, storeListingVariants: { select: { id: true, stock: true } } },
        data: {
          organizationId: storeId,
          productId,
          sellPrice,
          buyPrice: buyPrice ?? null,
          compareAtPrice: compareAtPrice ?? null,
          stock,
          lowStockThreshold,
          trackInventory,
          isFeatured,
          status,
          storeListingVariants: {
            create: variants.map((variant) => ({
              variantId: variant.variantId,
              sellPrice: variant.sellPrice ?? null,
              stock: variant.stock,
              status: variant.status,
              // Tracking and the alert are set on the listing and apply to its variants
              trackInventory,
              lowStockThreshold,
            })),
          },
        },
      })
      const initial = { reason: StockMovementReason.INITIAL, createdById: session.user.id }
      await recordStockMovement(tx, { listingId: listing.id, listingVariantId: null }, listing.stock, listing.stock, initial)
      for (const row of listing.storeListingVariants) await recordStockMovement(tx, { listingId: listing.id, listingVariantId: row.id }, row.stock, row.stock, initial)
    }, TRANSACTION_OPTIONS)

    return { success: true }
  } catch (error) {
    return mapWriteError(error) ?? { success: false, error: formatError(error) }
  }
}

export async function updateListingAction(input: z.input<typeof updateListingSchema>): Promise<ActionResponse | StockChangedResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = updateListingSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { id, storeId, original, variants, ...fields } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { listing: ["update"] }))) return FORBIDDEN

    const listing = await prisma.storeListing.findFirst({ where: { id, organizationId: storeId }, select: { productId: true, product: { select: { hasVariants: true } } } })
    if (!listing) return NOT_FOUND
    // A listing stays editable whatever its product's status, so it can be archived when the product goes
    if (!(await hasCurrentVariants(listing.productId, listing.product.hasVariants, variants))) return VARIANTS_CHANGED

    await prisma.$transaction((tx) => syncListing(tx, { id, original, variants, ...fields }, session.user.id), TRANSACTION_OPTIONS)

    return { success: true }
  } catch (error) {
    if (error instanceof StockChangedError) {
      return {
        success: false,
        error: "Stock changed while you were editing, for example after a sale. Check the marked fields and save again.",
        code: "STOCK_CHANGED",
        currentStock: error.currentStock,
      }
    }
    return mapWriteError(error) ?? { success: false, error: formatError(error) }
  }
}

export async function deleteListingAction(input: z.input<typeof deleteListingSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = deleteListingSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { id, storeId } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { listing: ["delete"] }))) return FORBIDDEN

    const listing = await prisma.storeListing.findFirst({ where: { id, organizationId: storeId }, select: { id: true } })
    if (!listing) return NOT_FOUND

    // Order and purchase order lines restrict the delete, so a listing that has been ordered or bought in can only be archived
    const [ordered, purchased] = await Promise.all([
      prisma.orderItem.findFirst({ where: { storeListingId: id }, select: { id: true } }),
      prisma.purchaseOrderItem.findFirst({ where: { storeListingId: id }, select: { id: true } }),
    ])
    if (ordered || purchased) return HAS_ORDERS

    // Its variants, cart items and reviews cascade
    await prisma.storeListing.delete({ where: { id } })
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
