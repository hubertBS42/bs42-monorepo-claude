import "server-only"

import { authURLs } from "@workspace/auth/constants"
import { customerVisibleListingWhere, hiddenReason, loadVisibleCategoryIds, variantOnSaleWhere } from "@workspace/commerce/visibility"
import { prisma } from "@workspace/db"

// Where staff can see a product as customers do: its storefront page, which exists only while some store's listing
// of it is on sale (@workspace/commerce/visibility). Otherwise, why not. Called after the page's own guard.
export interface StorefrontLink {
  url: string | null
  reason: string | null
}

const productUrl = (slug: string) => new URL(`/p/${slug}`, authURLs.store).toString()

export async function getProductStorefrontLink(productId: string): Promise<StorefrontLink> {
  const visibleCategoryIds = await loadVisibleCategoryIds(prisma)
  const [product, onSale] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { slug: true } }),
    prisma.storeListing.count({ where: { productId, ...customerVisibleListingWhere(visibleCategoryIds) } }),
  ])
  if (!product) return { url: null, reason: null }
  if (onSale) return { url: productUrl(product.slug), reason: null }
  return { url: null, reason: 'No store sells it to customers yet. Each store\'s listings table says why under "Not on sale".' }
}

// A listing shares its product's page with every other store's: the page shows the best offer, which may be another store's
export async function getListingStorefrontLink(storeId: string, listingId: string): Promise<StorefrontLink> {
  const [visibleCategoryIds, listing] = await Promise.all([
    loadVisibleCategoryIds(prisma),
    prisma.storeListing.findFirst({
      where: { id: listingId, organizationId: storeId },
      select: {
        status: true,
        sellPrice: true,
        organization: { select: { status: true } },
        product: { select: { slug: true, status: true, hasVariants: true, categoryId: true, brand: { select: { name: true, status: true } } } },
        storeListingVariants: { where: variantOnSaleWhere, select: { sellPrice: true } },
      },
    }),
  ])
  if (!listing) return { url: null, reason: null }
  const reason = hiddenReason(listing, visibleCategoryIds, listing.product.hasVariants ? listing.storeListingVariants : undefined)
  return reason ? { url: null, reason } : { url: productUrl(listing.product.slug), reason: null }
}
