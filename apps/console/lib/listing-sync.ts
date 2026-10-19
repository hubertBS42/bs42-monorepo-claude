import "server-only"

import type { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { StockMovementReason } from "@workspace/db/enums"
import type { z } from "zod"
import type { updateListingSchema } from "./schemas/listing.schemas"
import { recordStockMovement, type StockMovementSource } from "./stock-movements"
import type { ListingSnapshot, StockChangedResponse } from "../types"

// Updating a listing in place, in its own module (like product-sync.ts) so the logic can be tested against the
// database without a session. updateListingAction checks the input, the permission and the variants first.

type ListingUpdate = z.output<typeof updateListingSchema>
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export class ListingConflictError extends Error {}
export class ListingNotFoundError extends Error {}
// Stock was changed by hand without saying why, which the stock history needs
export class StockReasonRequiredError extends Error {}
export class StockChangedError extends Error {
  readonly currentStock: StockChangedResponse["currentStock"]

  constructor(currentStock: StockChangedResponse["currentStock"]) {
    super("Stock changed")
    this.currentStock = currentStock
  }
}

const savedListingSelect = {
  sellPrice: true,
  buyPrice: true,
  compareAtPrice: true,
  stock: true,
  lowStockThreshold: true,
  trackInventory: true,
  isFeatured: true,
  status: true,
  storeListingVariants: { select: { id: true, variantId: true, sellPrice: true, stock: true, status: true, trackInventory: true, lowStockThreshold: true } },
} satisfies Prisma.StoreListingSelect

type SavedListing = Prisma.StoreListingGetPayload<{ select: typeof savedListingSelect }>

function sameAmount(saved: Prisma.Decimal | null, submitted: number | null | undefined) {
  return saved === null ? submitted == null : submitted != null && saved.equals(submitted)
}

// Whether anything but stock differs from what the form loaded, i.e. someone else saved the listing meanwhile.
// Stock is left out: sales change it all the time, and it has its own check.
function changedElsewhere(saved: SavedListing, original: ListingSnapshot) {
  const listingChanged =
    !sameAmount(saved.sellPrice, original.sellPrice) ||
    !sameAmount(saved.buyPrice, original.buyPrice) ||
    !sameAmount(saved.compareAtPrice, original.compareAtPrice) ||
    saved.lowStockThreshold !== original.lowStockThreshold ||
    saved.trackInventory !== original.trackInventory ||
    saved.isFeatured !== original.isFeatured ||
    saved.status !== original.status
  if (listingChanged) return true

  const savedVariants = new Map(saved.storeListingVariants.map((variant) => [variant.variantId, variant]))
  return original.variants.some((variant) => {
    const row = savedVariants.get(variant.variantId)
    return row && (!sameAmount(row.sellPrice, variant.sellPrice) || row.status !== variant.status)
  })
}

// Throws ListingNotFoundError, ListingConflictError (changed elsewhere), StockChangedError (stock the user changed was
// changed elsewhere) or StockReasonRequiredError, so the transaction rolls back. Stock the user changed goes into the
// stock history with their reason; a variant new to the listing starts it with its initial stock.
export async function syncListing(tx: Tx, { id, original, variants, stock, buyPrice, compareAtPrice, stockReason, stockNote, ...fields }: Omit<ListingUpdate, "storeId">, changedById: string) {
  // Lock the listing and its variants until the transaction ends, so a sale can't change stock between
  // the checks below and the writes (it waits instead)
  await tx.$queryRaw`SELECT 1 FROM "store_listing" WHERE "id" = ${id}::uuid FOR UPDATE`
  await tx.$queryRaw`SELECT 1 FROM "store_listing_variant" WHERE "storeListingId" = ${id}::uuid FOR UPDATE`

  const saved = await tx.storeListing.findUnique({ where: { id }, select: savedListingSelect })
  if (!saved) throw new ListingNotFoundError()
  if (changedElsewhere(saved, original)) throw new ListingConflictError()

  // Stock the user changed must still hold what they saw; stock they left alone isn't written
  const savedVariants = new Map(saved.storeListingVariants.map((variant) => [variant.variantId, variant]))
  const originalVariants = new Map(original.variants.map((variant) => [variant.variantId, variant]))
  const listingStockChanged = stock !== original.stock && saved.stock !== original.stock
  const variantStockChanged = variants.some((variant) => {
    const row = savedVariants.get(variant.variantId)
    const loaded = originalVariants.get(variant.variantId)?.stock
    return row && loaded !== undefined && variant.stock !== loaded && row.stock !== loaded
  })
  if (listingStockChanged || variantStockChanged) {
    throw new StockChangedError({ listing: saved.stock, variants: Object.fromEntries(saved.storeListingVariants.map((variant) => [variant.variantId, variant.stock])) })
  }

  // Past the check above, any stock the user changed still holds what they loaded, so the change is new minus saved
  const userChangedVariants = variants.filter((variant) => savedVariants.has(variant.variantId) && variant.stock !== originalVariants.get(variant.variantId)?.stock)
  if ((stock !== original.stock || userChangedVariants.length) && !stockReason) throw new StockReasonRequiredError()
  const byHand: StockMovementSource = { reason: stockReason ?? StockMovementReason.OTHER, note: stockNote, createdById: changedById }

  await tx.storeListing.update({
    where: { id },
    data: { ...fields, buyPrice: buyPrice ?? null, compareAtPrice: compareAtPrice ?? null, ...(stock !== original.stock && { stock }) },
  })
  if (stock !== original.stock) await recordStockMovement(tx, { listingId: id, listingVariantId: null }, stock - saved.stock, stock, byHand)

  // Variants added to the product since the listing was made
  const added = variants.filter((variant) => !savedVariants.has(variant.variantId))
  if (added.length) {
    const created = await tx.storeListingVariant.createManyAndReturn({
      select: { id: true, stock: true },
      data: added.map((variant) => ({
        storeListingId: id,
        variantId: variant.variantId,
        sellPrice: variant.sellPrice ?? null,
        stock: variant.stock,
        status: variant.status,
        trackInventory: fields.trackInventory,
        lowStockThreshold: fields.lowStockThreshold,
      })),
    })
    for (const row of created) {
      await recordStockMovement(tx, { listingId: id, listingVariantId: row.id }, row.stock, row.stock, { reason: StockMovementReason.INITIAL, createdById: changedById })
    }
  }

  // Only rows that changed: each statement is a round trip to a slow database
  for (const variant of variants) {
    const row = savedVariants.get(variant.variantId)
    if (!row) continue

    const stockChanged = variant.stock !== originalVariants.get(variant.variantId)?.stock
    const changed =
      stockChanged ||
      !sameAmount(row.sellPrice, variant.sellPrice) ||
      row.status !== variant.status ||
      row.trackInventory !== fields.trackInventory ||
      row.lowStockThreshold !== fields.lowStockThreshold
    if (changed) {
      await tx.storeListingVariant.update({
        where: { id: row.id },
        data: {
          sellPrice: variant.sellPrice ?? null,
          status: variant.status,
          trackInventory: fields.trackInventory,
          lowStockThreshold: fields.lowStockThreshold,
          ...(stockChanged && { stock: variant.stock }),
        },
      })
      if (stockChanged) await recordStockMovement(tx, { listingId: id, listingVariantId: row.id }, variant.stock - row.stock, variant.stock, byHand)
    }
  }
}
