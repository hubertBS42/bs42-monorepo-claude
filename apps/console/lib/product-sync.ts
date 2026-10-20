import "server-only"

import { generateUniqueSku, prisma } from "@workspace/db"
import { Status } from "@workspace/db/enums"
import type { z } from "zod"
import type { updateProductFormSchema } from "./schemas/product.schemas"

// Specs are saved separately (product-specs.ts)
type ProductUpdate = Omit<z.output<typeof updateProductFormSchema>, "specs">
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const valueKey = (option: string, value: string) => `${option}\u0000${value}`
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item) => b.includes(item))

// The product as saved, with what's needed to update it in place and to know what can't be deleted
export async function loadProductForUpdate(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      images: true,
      banner: true,
      documents: { select: { id: true, url: true } },
      variantOptions: { select: { id: true, name: true, position: true, values: { select: { id: true, value: true, position: true } } } },
      variants: {
        where: { status: { not: Status.ARCHIVED } },
        select: {
          id: true,
          sku: true,
          barcode: true,
          images: true,
          weight: true,
          dimensions: true,
          position: true,
          variantValues: { select: { optionValueId: true } },
          _count: { select: { orderItems: true } },
          storeListingVariants: { select: { _count: { select: { orderItems: true, purchaseOrderItems: true } } } },
        },
      },
    },
  })
}

type SavedProduct = NonNullable<Awaited<ReturnType<typeof loadProductForUpdate>>>

/**
 * Updates a product and its options, values, variants and documents in place, inside the caller's transaction.
 * Rows are matched by id so store listings keep their prices and stock: a renamed value stays the same row. A
 * removed variant that has been ordered (directly or through a store's listing) or bought in on a store's purchase
 * order is archived, since order and purchase order lines restrict deleting it; any other is deleted, along with its store listing variants. Returns the files nothing
 * refers to any more, for the caller to remove once the transaction has committed.
 */
export async function syncProduct(tx: Tx, saved: SavedProduct, data: ProductUpdate & { description: string | null }): Promise<string[]> {
  const { id: productId, documents, variantOptions = [], variants = [], sku, barcode, weight, dimensions, banner, ...fields } = data
  const options = fields.hasVariants ? variantOptions : []
  const nextVariants = fields.hasVariants ? variants : []

  // 1. Variants that are no longer in the form: archive what has been ordered, delete the rest
  const savedVariantIds = new Set(saved.variants.map((variant) => variant.id))
  const keptVariantIds = new Set(nextVariants.flatMap((variant) => (variant.id && savedVariantIds.has(variant.id) ? [variant.id] : [])))
  const removed = saved.variants.filter((variant) => !keptVariantIds.has(variant.id))
  const isOrdered = (variant: SavedProduct["variants"][number]) =>
    variant._count.orderItems > 0 || variant.storeListingVariants.some((listing) => listing._count.orderItems > 0 || listing._count.purchaseOrderItems > 0)
  const toArchive = removed.filter(isOrdered).map((variant) => variant.id)
  const toDelete = removed.filter((variant) => !isOrdered(variant)).map((variant) => variant.id)
  if (toArchive.length) await tx.productVariant.updateMany({ where: { id: { in: toArchive } }, data: { status: Status.ARCHIVED } })
  if (toDelete.length) await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } })

  // 2. Options and their values, matched by id. Names are unique per product (and values per option), so anything
  // renamed first moves to a placeholder: swapping two names would otherwise clash halfway through.
  const savedOptions = new Map(saved.variantOptions.map((option) => [option.id, option]))
  const keptOptions = options.filter((option) => option.id && savedOptions.has(option.id))
  const keptOptionIds = keptOptions.map((option) => option.id!)
  const droppedOptionIds = saved.variantOptions.filter((option) => !keptOptionIds.includes(option.id)).map((option) => option.id)
  if (droppedOptionIds.length) await tx.variantOption.deleteMany({ where: { id: { in: droppedOptionIds } } })

  for (const option of keptOptions) {
    if (savedOptions.get(option.id!)!.name !== option.name) await tx.variantOption.update({ where: { id: option.id }, data: { name: `(renaming ${option.id})` } })
  }

  const valueIds = new Map<string, string>()
  for (const option of options) {
    const savedOption = option.id ? savedOptions.get(option.id) : undefined
    if (savedOption) {
      const optionId = savedOption.id
      if (savedOption.name !== option.name || savedOption.position !== option.position) {
        await tx.variantOption.update({ where: { id: optionId }, data: { name: option.name, position: option.position } })
      }

      const savedValues = new Map(savedOption.values.map((value) => [value.id, value]))
      const keptValues = option.values.filter((value) => value.id && savedValues.has(value.id))
      const keptValueIds = keptValues.map((value) => value.id!)
      const droppedValueIds = savedOption.values.filter((value) => !keptValueIds.includes(value.id)).map((value) => value.id)
      if (droppedValueIds.length) await tx.variantOptionValue.deleteMany({ where: { id: { in: droppedValueIds } } })

      for (const value of keptValues) {
        if (savedValues.get(value.id!)!.value !== value.value) await tx.variantOptionValue.update({ where: { id: value.id }, data: { value: `(renaming ${value.id})` } })
      }
      for (const value of option.values) {
        const savedValue = value.id ? savedValues.get(value.id) : undefined
        if (savedValue) {
          if (savedValue.value !== value.value || savedValue.position !== value.position) {
            await tx.variantOptionValue.update({ where: { id: savedValue.id }, data: { value: value.value, position: value.position } })
          }
          valueIds.set(valueKey(option.name, value.value), savedValue.id)
        } else {
          const created = await tx.variantOptionValue.create({ data: { optionId, value: value.value, position: value.position }, select: { id: true } })
          valueIds.set(valueKey(option.name, value.value), created.id)
        }
      }
    } else {
      const created = await tx.variantOption.create({
        data: { productId, name: option.name, position: option.position, values: { create: option.values.map(({ value, position }) => ({ value, position })) } },
        select: { id: true, values: { select: { id: true, value: true } } },
      })
      for (const value of created.values) valueIds.set(valueKey(option.name, value.value), value.id)
    }
  }

  // 3. Variants in the form: update the kept ones where something changed, create the new ones
  const savedVariants = new Map(saved.variants.map((variant) => [variant.id, variant]))
  for (const variant of nextVariants) {
    const optionValueIds = Object.entries(variant.attributes).map(([option, value]) => {
      const id = valueIds.get(valueKey(option, value))
      // The schema checks every attribute against the options, so this only happens if the two disagree
      if (!id) throw new Error(`Unknown option value ${option}: ${value}`)
      return id
    })
    const details = {
      barcode: variant.barcode || null,
      images: variant.images,
      weight: variant.weight ?? null,
      dimensions: variant.dimensions || null,
      position: variant.position,
    }

    const savedVariant = variant.id ? savedVariants.get(variant.id) : undefined
    if (!savedVariant) {
      await tx.productVariant.create({
        data: { productId, ...details, sku: variant.sku || (await generateUniqueSku(tx, fields.name)), variantValues: { create: optionValueIds.map((optionValueId) => ({ optionValueId })) } },
      })
      continue
    }

    const changed =
      (variant.sku || savedVariant.sku) !== savedVariant.sku ||
      details.barcode !== savedVariant.barcode ||
      // Order matters: the first image is the one shown
      details.images.join("\n") !== savedVariant.images.join("\n") ||
      (details.weight ?? null) !== (savedVariant.weight?.toNumber() ?? null) ||
      details.dimensions !== savedVariant.dimensions ||
      details.position !== savedVariant.position
    if (changed) {
      // An emptied SKU keeps the saved one: a variant always has a SKU, and changing it would break store records
      await tx.productVariant.update({ where: { id: savedVariant.id }, data: { ...details, sku: variant.sku || savedVariant.sku } })
    }

    const savedValueIds = savedVariant.variantValues.map((link) => link.optionValueId)
    if (!sameSet(savedValueIds, optionValueIds)) {
      await tx.productVariantValue.deleteMany({ where: { variantId: savedVariant.id } })
      await tx.productVariantValue.createMany({ data: optionValueIds.map((optionValueId) => ({ variantId: savedVariant.id, optionValueId })) })
    }
  }

  // 4. Documents, matched by id
  const savedDocumentIds = new Set(saved.documents.map((document) => document.id))
  const keptDocumentIds = documents.flatMap((document) => (document.id && savedDocumentIds.has(document.id) ? [document.id] : []))
  const droppedDocumentIds = saved.documents.filter((document) => !keptDocumentIds.includes(document.id)).map((document) => document.id)
  if (droppedDocumentIds.length) await tx.productDocument.deleteMany({ where: { id: { in: droppedDocumentIds } } })
  const newDocuments = documents.filter((document) => !(document.id && savedDocumentIds.has(document.id)))
  if (newDocuments.length) await tx.productDocument.createMany({ data: newDocuments.map(({ name, url }) => ({ productId, name, url })) })

  // 5. The product itself. A simple product without a SKU gets one; a product with variants keeps them per variant.
  await tx.product.update({
    where: { id: productId },
    data: {
      ...fields,
      banner: banner || null,
      ...(fields.hasVariants
        ? { sku: null, barcode: null, weight: null, dimensions: null }
        : { sku: sku || (await generateUniqueSku(tx, fields.name)), barcode: barcode || null, weight: weight ?? null, dimensions: dimensions || null }),
    },
  })

  // Files that were on the product and aren't now. Archived variants keep theirs for past orders.
  const archivedImages = saved.variants.filter((variant) => toArchive.includes(variant.id)).flatMap((variant) => variant.images)
  const before = [...saved.images, ...(saved.banner ? [saved.banner] : []), ...saved.documents.map((document) => document.url), ...saved.variants.flatMap((variant) => variant.images)]
  const after = new Set([...fields.images, ...(banner ? [banner] : []), ...documents.map((document) => document.url), ...nextVariants.flatMap((variant) => variant.images), ...archivedImages])
  return [...new Set(before)].filter((url) => !after.has(url))
}
