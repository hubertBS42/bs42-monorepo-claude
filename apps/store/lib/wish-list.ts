import "server-only"

import { describeVariant } from "@workspace/commerce/order-writes"
import { customerVisibleListingWhere, loadVisibleCategoryIds, variantOnSaleWhere } from "@workspace/commerce/visibility"
import type { prisma } from "@workspace/db"

// A signed-in customer's wish list: products (or variants) saved for later, never stores. Saving needs the item on
// sale, so a product id can't be used to read a product customers never saw; a saved item that stops being on sale
// stays on the list, as it may come back. In its own module, with relative imports, so it can be tested against the
// database without a request.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx

export const MAX_WISH_LIST_ITEMS = 100

export type WishListErrorCode = "ITEM_UNAVAILABLE" | "LIST_FULL"

export class WishListError extends Error {
  readonly code: WishListErrorCode

  constructor(code: WishListErrorCode) {
    super(code === "LIST_FULL" ? `Your wish list is full: it holds up to ${MAX_WISH_LIST_ITEMS} items. Remove one to save another.` : "That's no longer on sale.")
    this.code = code
  }
}

export interface WishListKey {
  productId: string
  variantId: string | null
}

const countItems = (client: Client, userId: string) => client.wishListItem.count({ where: { userId } })

// Saves an item, once: saving it again changes nothing. Two saves at once can both pass the limit check, so a list can
// end up one over; that's harmless. Returns the list's new size.
export async function saveWishListItem(client: Client, userId: string, { productId, variantId }: WishListKey) {
  const visibleCategoryIds = await loadVisibleCategoryIds(client)
  const onSale = await client.storeListing.findFirst({
    where: { AND: [customerVisibleListingWhere(visibleCategoryIds), { productId }, variantId ? { storeListingVariants: { some: { ...variantOnSaleWhere, variantId } } } : {}] },
    select: { id: true },
  })
  if (!onSale) throw new WishListError("ITEM_UNAVAILABLE")

  const saved = await client.wishListItem.findFirst({ where: { userId, productId, variantId }, select: { id: true } })
  if (!saved) {
    if ((await countItems(client, userId)) >= MAX_WISH_LIST_ITEMS) throw new WishListError("LIST_FULL")
    // ON CONFLICT DO NOTHING covers both unique keys, including the partial one for products without variants
    await client.wishListItem.createMany({ data: { userId, productId, variantId }, skipDuplicates: true })
  }
  return countItems(client, userId)
}

// Removing an item that isn't on the list isn't an error: another tab may have removed it. Returns the list's new size.
export async function removeWishListItem(client: Client, userId: string, { productId, variantId }: WishListKey) {
  await client.wishListItem.deleteMany({ where: { userId, productId, variantId } })
  return countItems(client, userId)
}

// What the hearts need: which items are saved
export function getWishListKeys(client: Client, userId: string): Promise<WishListKey[]> {
  return client.wishListItem.findMany({ where: { userId }, select: { productId: true, variantId: true } })
}

// The list's page: newest first, with enough of each product to show one that's no longer on sale
export async function getWishList(client: Client, userId: string) {
  const items = await client.wishListItem.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      productId: true,
      variantId: true,
      product: { select: { name: true, slug: true, images: true, brand: { select: { name: true } } } },
      variant: { select: { images: true, variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } } } },
    },
  })

  return items.map(({ id, productId, variantId, product, variant }) => ({
    id,
    productId,
    variantId,
    name: product.name,
    slug: product.slug,
    brandName: product.brand.name,
    image: variant?.images[0] ?? product.images[0] ?? null,
    variantLabel: variant ? describeVariant(variant.variantValues) : null,
  }))
}

export type WishListEntry = Awaited<ReturnType<typeof getWishList>>[number]
