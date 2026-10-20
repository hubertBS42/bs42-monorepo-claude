import "server-only"

import type { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { OrganizationStatus, Status } from "@workspace/db/enums"

// What customers can see and buy: one rule for the storefront's pages and orders and for the console's "visible to
// customers" filter and "Not on sale" note. It has two forms that must agree: customerVisibleListingWhere for queries,
// and hiddenReason for a row already loaded. Change both together.

type Client = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface CategoryForVisibility {
  id: string
  parentId: string | null
  status: Status
}

// Categories customers see: published, with every category above them published. Prisma can't follow the tree, so
// it's worked out from the whole tree, which is small.
export function getVisibleCategoryIds(categories: CategoryForVisibility[]): Set<string> {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const visible = new Map<string, boolean>()

  const isVisible = (id: string): boolean => {
    const known = visible.get(id)
    if (known !== undefined) return known
    const category = byId.get(id)
    // The tree can't have cycles (a trigger refuses them), so this ends at the top
    const result = !!category && category.status === Status.PUBLISHED && (!category.parentId || isVisible(category.parentId))
    visible.set(id, result)
    return result
  }

  return new Set(categories.filter((category) => isVisible(category.id)).map((category) => category.id))
}

export async function loadVisibleCategoryIds(client: Client) {
  return getVisibleCategoryIds(await client.category.findMany({ select: { id: true, parentId: true, status: true } }))
}

// A listing's variant on sale: published in the store and not archived in the catalogue
export const variantOnSaleWhere = { status: Status.PUBLISHED, variant: { status: { not: Status.ARCHIVED } } } satisfies Prisma.StoreListingVariantWhereInput

// Listings customers can see and buy. A variant without its own price sells at the listing's, so either must be above 0.
export function customerVisibleListingWhere(visibleCategoryIds: Iterable<string>): Prisma.StoreListingWhereInput {
  return {
    status: Status.PUBLISHED,
    organization: { status: OrganizationStatus.ACTIVE },
    product: { status: Status.PUBLISHED, brand: { status: Status.PUBLISHED }, categoryId: { in: [...visibleCategoryIds] } },
    OR: [
      { product: { hasVariants: false }, sellPrice: { gt: 0 } },
      {
        product: { hasVariants: true },
        storeListingVariants: { some: { ...variantOnSaleWhere, OR: [{ sellPrice: { gt: 0 } }, { sellPrice: null, storeListing: { sellPrice: { gt: 0 } } }] } },
      },
    ],
  }
}

export interface ListingForVisibility {
  status: Status
  sellPrice: Prisma.Decimal
  organization: { status: OrganizationStatus }
  product: { status: Status; hasVariants: boolean; categoryId: string; brand: { name: string; status: Status } }
}

// Why customers can't see or buy a listing, for staff, or null when they can. Pass the listing's variants on sale
// (variantOnSaleWhere) to check a product with variants has one with a price; leave them out to check only the listing,
// as an order does, which checks the variant it asks for itself.
export function hiddenReason(listing: ListingForVisibility, visibleCategoryIds: Set<string>, variantsOnSale?: { sellPrice: Prisma.Decimal | null }[]): string | null {
  const { product } = listing
  if (listing.status !== Status.PUBLISHED) return `The listing is ${listing.status.toLowerCase()}.`
  if (listing.organization.status !== OrganizationStatus.ACTIVE) return "The store is suspended."
  if (product.status !== Status.PUBLISHED) return `The catalogue product is ${product.status.toLowerCase()}.`
  if (product.brand.status !== Status.PUBLISHED) return `The brand ${product.brand.name} is ${product.brand.status.toLowerCase()}.`
  if (!visibleCategoryIds.has(product.categoryId)) return "Its category, or one above it, isn't published."
  if (!product.hasVariants) return listing.sellPrice.gt(0) ? null : "The price is 0."
  if (!variantsOnSale) return null
  if (variantsOnSale.length === 0) return "No variant is published."
  return variantsOnSale.some((variant) => (variant.sellPrice ?? listing.sellPrice).gt(0)) ? null : "Every variant's price is 0."
}
