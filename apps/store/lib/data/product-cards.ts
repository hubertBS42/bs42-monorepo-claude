import "server-only"

import { unstable_cache } from "next/cache"
import { customerVisibleListingWhere, getVisibleCategoryIds, variantOnSaleWhere } from "@workspace/commerce/visibility"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { PurchaseOrderStatus, SpecType } from "@workspace/db/enums"

import { pickOffers, type Offer, type ProductCardData, type SpecValue, type StockState } from "@/lib/product-cards"

// Which products a page lists: a category's (with the categories under it), a brand's, a search's, those a store
// features (the homepage), or one product (its page)
export type ProductScope = { categoryIds: string[] } | { brandId: string } | { search: string } | { featured: true } | { slug: string }

const OPEN_PURCHASE_ORDER = [PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.PARTIALLY_RECEIVED]

const listingSelect = {
  id: true,
  sellPrice: true,
  compareAtPrice: true,
  stock: true,
  trackInventory: true,
  lowStockThreshold: true,
  isFeatured: true,
  // What's still to arrive on open purchase orders, for "due w/c"
  purchaseOrderItems: {
    where: { purchaseOrder: { status: { in: OPEN_PURCHASE_ORDER } } },
    select: { storeListingVariantId: true, quantityOrdered: true, quantityReceived: true, purchaseOrder: { select: { expectedOn: true } } },
  },
  storeListingVariants: {
    where: variantOnSaleWhere,
    select: {
      id: true,
      variantId: true,
      sellPrice: true,
      compareAtPrice: true,
      stock: true,
      trackInventory: true,
      lowStockThreshold: true,
      variant: { select: { images: true, variantValues: { select: { optionValueId: true } } } },
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
      condition: true,
      createdAt: true,
      hasVariants: true,
      categoryId: true,
      brand: { select: { id: true, name: true, slug: true } },
      variantOptions: { orderBy: { position: "asc" }, select: { name: true, values: { orderBy: { position: "asc" }, select: { id: true, value: true } } } },
      specValues: {
        select: {
          numberValue: true,
          booleanValue: true,
          textValue: true,
          option: { select: { value: true, position: true } },
          spec: { select: { id: true, name: true, type: true, unit: true, position: true, categoryId: true } },
        },
      },
    },
  },
} satisfies Prisma.StoreListingSelect

type ListingRow = Prisma.StoreListingGetPayload<{ select: typeof listingSelect }>
type SpecRow = ListingRow["product"]["specValues"][number]

export function slugifyValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function toSpecValue({ spec, option, numberValue, booleanValue, textValue }: SpecRow): SpecValue | null {
  switch (spec.type) {
    case SpecType.SELECT:
      return option && { specId: spec.id, name: spec.name, type: spec.type, label: option.value, key: slugifyValue(option.value), sort: option.position }
    case SpecType.NUMBER: {
      if (numberValue === null) return null
      // Decimal's toString drops the trailing zeros of the column's four places
      const number = numberValue.toString()
      return { specId: spec.id, name: spec.name, type: spec.type, label: spec.unit ? `${number} ${spec.unit}` : number, key: number, sort: numberValue.toNumber() }
    }
    case SpecType.BOOLEAN:
      return booleanValue === null ? null : { specId: spec.id, name: spec.name, type: spec.type, label: booleanValue ? "Yes" : "No", key: booleanValue ? "yes" : "no", sort: booleanValue ? 0 : 1 }
    case SpecType.TEXT:
      return textValue ? { specId: spec.id, name: spec.name, type: spec.type, label: textValue, key: slugifyValue(textValue), sort: textValue.toLowerCase() } : null
  }
}

// Stock to sell, or what's still to arrive on open purchase orders for the row, with the earliest expected day
function stockState(row: { stock: number; trackInventory: boolean; lowStockThreshold: number }, incoming: ListingRow["purchaseOrderItems"]): StockState {
  if (!row.trackInventory) return { kind: "in-stock", left: null }
  if (row.stock > 0) return { kind: "in-stock", left: row.stock <= row.lowStockThreshold ? row.stock : null }
  const open = incoming.filter((item) => item.quantityOrdered > item.quantityReceived)
  const days = open.flatMap((item) => (item.purchaseOrder.expectedOn ? [item.purchaseOrder.expectedOn.toISOString().slice(0, 10)] : [])).sort()
  return { kind: "out", onOrder: open.length > 0, dueOn: days[0] ?? null }
}

// Everything a listing offers: itself without variants, else each variant on sale with a price above 0 (its own, or
// the listing's). Prices and compare-at prices as the listing form saves them: a variant without its own uses the
// listing's.
function listingOffers(listing: ListingRow): Offer[] {
  const productImage = listing.product.images[0] ?? null
  if (!listing.product.hasVariants) {
    return [
      {
        variantId: null,
        optionValueIds: [],
        listingId: listing.id,
        listingVariantId: null,
        priceUsd: listing.sellPrice.toString(),
        compareAtUsd: listing.compareAtPrice?.gt(listing.sellPrice) ? listing.compareAtPrice.toString() : null,
        stock: stockState(listing, listing.purchaseOrderItems),
        image: productImage,
      },
    ]
  }
  return listing.storeListingVariants.flatMap((row): Offer[] => {
    const price = row.sellPrice ?? listing.sellPrice
    const compareAt = row.compareAtPrice ?? listing.compareAtPrice
    if (!price.gt(0)) return []
    return [
      {
        variantId: row.variantId,
        optionValueIds: row.variant.variantValues.map((value) => value.optionValueId),
        listingId: listing.id,
        listingVariantId: row.id,
        priceUsd: price.toString(),
        compareAtUsd: compareAt?.gt(price) ? compareAt.toString() : null,
        stock: stockState(
          row,
          listing.purchaseOrderItems.filter((item) => item.storeListingVariantId === row.id)
        ),
        image: row.variant.images[0] ?? productImage,
      },
    ]
  })
}

// Every store's listings of the products in scope. Featured: products some store features, with all their offers, so the
// homepage shows the same price as the category page.
function scopeWhere(scope: ProductScope, visible: Prisma.StoreListingWhereInput): Prisma.StoreListingWhereInput {
  if ("categoryIds" in scope) return { product: { categoryId: { in: scope.categoryIds } } }
  if ("brandId" in scope) return { product: { brandId: scope.brandId } }
  if ("slug" in scope) return { product: { slug: scope.slug } }
  if ("featured" in scope) return { product: { storeListings: { some: { AND: [visible, { isFeatured: true }] } } } }
  // As the console's products search: the name, SKU or barcode, including the variants'
  const contains = { contains: scope.search, mode: "insensitive" as const }
  return { product: { OR: [{ name: contains }, { sku: contains }, { barcode: contains }, { variants: { some: { OR: [{ sku: contains }, { barcode: contains }] } } }] } }
}

// The products in a scope that customers can buy, each with its offers from every store selling it. Filtering,
// sorting and paging happen on this list (lib/catalogue-filters.ts): a category's products are few enough to load at
// once, and a filter's counts need them all anyway. Cached for a minute: an order checks stock and prices again.
export const loadProductCards = unstable_cache(
  async (scope: ProductScope): Promise<ProductCardData[]> => {
    const categories = await prisma.category.findMany({ select: { id: true, parentId: true, status: true } })
    const visibleIds = getVisibleCategoryIds(categories)
    const visible = customerVisibleListingWhere(visibleIds)
    const listings = await prisma.storeListing.findMany({ where: { AND: [visible, scopeWhere(scope, visible)] }, select: listingSelect })

    // How deep each category is, so a product's specs go top category first, as on the product form
    const parents = new Map(categories.map((category) => [category.id, category.parentId]))
    const depth = (id: string) => {
      let levels = 0
      for (let parent = parents.get(id); parent; parent = parents.get(parent)) levels++
      return levels
    }

    const byProduct = new Map<string, ListingRow[]>()
    for (const listing of listings) byProduct.set(listing.product.id, [...(byProduct.get(listing.product.id) ?? []), listing])

    return [...byProduct.values()].flatMap((rows): ProductCardData[] => {
      const offers = pickOffers(rows.flatMap(listingOffers))
      if (!offers.length) return []
      const { product } = rows[0]!
      const offered = new Set(offers.flatMap((offer) => offer.optionValueIds))

      return [
        {
          id: product.id,
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          categoryId: product.categoryId,
          condition: product.condition,
          image: product.images[0] ?? null,
          isFeatured: rows.some((row) => row.isFeatured && offers.some((offer) => offer.listingId === row.id)),
          createdAt: product.createdAt.getTime(),
          specs: [...product.specValues]
            .sort((a, b) => depth(a.spec.categoryId) - depth(b.spec.categoryId) || a.spec.position - b.spec.position || a.spec.name.localeCompare(b.spec.name))
            .flatMap((row) => toSpecValue(row) ?? []),
          options: product.variantOptions.map((option) => ({ name: option.name, values: option.values.filter((value) => offered.has(value.id)) })).filter((option) => option.values.length > 0),
          offers,
        },
      ]
    })
  },
  ["store-product-cards"],
  { revalidate: 60 }
)
