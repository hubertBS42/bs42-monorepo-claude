import "server-only"

import type { PricingContext } from "@workspace/commerce/exchange-rates"
import { loadInstallationFees } from "@workspace/commerce/installation"
import { describeVariant } from "@workspace/commerce/order-writes"
import { priceOrder, shelfPrice, withTax } from "@workspace/commerce/pricing"
import { customerVisibleListingWhere, loadVisibleCategoryIds, variantOnSaleWhere } from "@workspace/commerce/visibility"
import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { MAX_LINE_QUANTITY } from "./basket-limits"

// The basket: one line per thing customers can buy (a product without variants, or a variant), each held at one
// store's listing. Adding picks the store (one already in the basket if it has the item in stock, else the offer the
// page showed, else the cheapest in stock); viewing checks every line again and moves a line to another store, or
// lowers its quantity, or drops it, when its store can no longer sell it. A line can include installation of every unit,
// which is taken off with a notice if the product stops offering it. The order checks prices and stock once more.
// In its own module, with relative imports, so it can be tested against the database without a request.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx

const CART_MESSAGES = {
  ITEM_UNAVAILABLE: "That's no longer on sale.",
  OUT_OF_STOCK: "That's out of stock.",
  LINE_NOT_FOUND: "That item isn't in your basket any more.",
  NO_INSTALLATION: "Installation isn't offered for that item.",
}

export type CartErrorCode = keyof typeof CART_MESSAGES

export class CartError extends Error {
  readonly code: CartErrorCode

  constructor(code: CartErrorCode) {
    super(CART_MESSAGES[code])
    this.code = code
  }
}

// One store's listing (or listing variant) of an item, as customers can buy it. `available` is null when the row
// doesn't track stock.
interface Candidate {
  storeId: string
  listingId: string
  listingVariantId: string | null
  priceUsd: Prisma.Decimal
  available: number | null
}

interface Item {
  productId: string
  variantId: string | null
}

const itemKey = (item: Item) => `${item.productId}:${item.variantId ?? ""}`
const rowKey = (row: { listingId: string; listingVariantId: string | null }) => `${row.listingId}:${row.listingVariantId ?? ""}`
const limit = (candidate: Candidate) => Math.min(candidate.available ?? MAX_LINE_QUANTITY, MAX_LINE_QUANTITY)

// Every store's listing of each item that customers can buy (visibility.ts), by item
async function loadCandidates(client: Client, items: Item[]): Promise<Map<string, Candidate[]>> {
  const byItem = new Map<string, Candidate[]>()
  if (!items.length) return byItem

  const visibleCategoryIds = await loadVisibleCategoryIds(client)
  const variantIds = items.flatMap((item) => (item.variantId ? [item.variantId] : []))
  const listings = await client.storeListing.findMany({
    where: { AND: [customerVisibleListingWhere(visibleCategoryIds), { productId: { in: [...new Set(items.map((item) => item.productId))] } }] },
    select: {
      id: true,
      organizationId: true,
      productId: true,
      sellPrice: true,
      stock: true,
      trackInventory: true,
      product: { select: { hasVariants: true } },
      storeListingVariants: { where: { ...variantOnSaleWhere, variantId: { in: variantIds } }, select: { id: true, variantId: true, sellPrice: true, stock: true, trackInventory: true } },
    },
  })

  const add = (item: Item, candidate: Candidate) => byItem.set(itemKey(item), [...(byItem.get(itemKey(item)) ?? []), candidate])
  for (const listing of listings) {
    const base = { storeId: listing.organizationId, listingId: listing.id }
    if (!listing.product.hasVariants) {
      add({ productId: listing.productId, variantId: null }, { ...base, listingVariantId: null, priceUsd: listing.sellPrice, available: listing.trackInventory ? listing.stock : null })
      continue
    }
    for (const row of listing.storeListingVariants) {
      // A variant without its own price sells at the listing's
      const priceUsd = row.sellPrice ?? listing.sellPrice
      if (priceUsd.gt(0)) add({ productId: listing.productId, variantId: row.variantId }, { ...base, listingVariantId: row.id, priceUsd, available: row.trackInventory ? row.stock : null })
    }
  }
  return byItem
}

// Which store a line is held at: the one it's at while that has stock, else a store already in the basket, else the
// one the page showed, else the cheapest. Null when no store has any in stock.
function chooseCandidate(candidates: Candidate[], prefer: { current?: string; stores: Set<string>; requested?: string }) {
  const inStock = candidates.filter((candidate) => candidate.available === null || candidate.available > 0)
  // Two-decimal prices compare exactly as numbers; the listing id breaks ties so the choice is the same every time
  inStock.sort((a, b) => a.priceUsd.comparedTo(b.priceUsd) || (rowKey(a) < rowKey(b) ? -1 : 1))
  return (
    inStock.find((candidate) => rowKey(candidate) === prefer.current) ??
    inStock.find((candidate) => prefer.stores.has(candidate.storeId)) ??
    inStock.find((candidate) => rowKey(candidate) === prefer.requested) ??
    inStock[0] ??
    null
  )
}

const lineSelect = {
  id: true,
  quantity: true,
  withInstallation: true,
  storeListingId: true,
  storeListingVariantId: true,
  storeListing: { select: { organizationId: true, productId: true } },
  storeListingVariant: { select: { variantId: true } },
} satisfies Prisma.CartItemSelect

type LineRow = Prisma.CartItemGetPayload<{ select: typeof lineSelect }>

const lineItem = (line: LineRow): Item => ({ productId: line.storeListing.productId, variantId: line.storeListingVariant?.variantId ?? null })
const lineRow = (line: LineRow) => ({ listingId: line.storeListingId, listingVariantId: line.storeListingVariantId })

// A signed-in customer's basket is their account's (Cart.userId), so it follows them from device to device. One made
// while signed out joins it when they sign in: its lines move across, and an item in both adds the two quantities (up
// to the most a line can hold; the next view lowers it to what's in stock). A basket that belongs to an account is
// nobody else's, so a signed-out visitor with its cookie gets a new one. Returns the basket's id (`sessionCartId`), or
// null when there is none and `create` is false. Run it in a transaction: a merge moves lines between two baskets.
export async function claimCart(client: Client, userId: string | null, cookieCartId: string | null, create: boolean) {
  const carts = await client.cart.findMany({
    where: { OR: [...(userId ? [{ userId }] : []), ...(cookieCartId ? [{ sessionCartId: cookieCartId }] : [])] },
    select: { id: true, userId: true, sessionCartId: true, items: { select: lineSelect } },
  })
  const owned = userId ? carts.find((cart) => cart.userId === userId) : undefined
  const guest = carts.find((cart) => cart.sessionCartId === cookieCartId && cart.userId === null)

  if (!userId) {
    if (guest || !cookieCartId) return guest?.sessionCartId ?? (create ? crypto.randomUUID() : null)
    // The cookie's basket is an account's, or gone (gone is fine: the first add makes it again)
    return carts.length ? (create ? crypto.randomUUID() : null) : cookieCartId
  }

  if (!guest) {
    if (owned) return owned.sessionCartId
    return create ? (await client.cart.create({ data: { sessionCartId: crypto.randomUUID(), userId }, select: { sessionCartId: true } })).sessionCartId : null
  }

  if (!owned) {
    // The guest basket becomes the account's
    await client.cart.update({ where: { id: guest.id }, data: { userId } })
    return guest.sessionCartId
  }

  for (const line of guest.items) {
    const match = owned.items.find((ownedLine) => itemKey(lineItem(ownedLine)) === itemKey(lineItem(line)))
    if (match) {
      await client.cartItem.update({
        where: { id: match.id },
        data: { quantity: Math.min(match.quantity + line.quantity, MAX_LINE_QUANTITY), withInstallation: match.withInstallation || line.withInstallation },
      })
    } else {
      await client.cartItem.update({ where: { id: line.id }, data: { cartId: owned.id } })
    }
  }
  // Its moved lines are the account's now; the matched ones go with it
  await client.cart.delete({ where: { id: guest.id } })
  await client.cart.update({ where: { id: owned.id }, data: { updatedAt: new Date() } })
  return owned.sessionCartId
}

export async function countCartItems(client: Client, sessionCartId: string) {
  const { _sum } = await client.cartItem.aggregate({ where: { cart: { sessionCartId } }, _sum: { quantity: true } })
  return _sum.quantity ?? 0
}

export interface AddToCartInput {
  // The offer the page showed
  listingId: string
  listingVariantId: string | null
  quantity: number
  // Ticked on the product page: the line then includes installation (adding without it leaves the line's as it was)
  installation?: boolean
}

// Adds to the item's line, creating the basket on its first item. The quantity is capped at what the line's store has;
// `added` says how many went in (0 when the line was already at the most there is).
export async function addCartItem(client: Client, sessionCartId: string, input: AddToCartInput) {
  // One after the other: a transaction has one connection
  const listing = await client.storeListing.findUnique({ where: { id: input.listingId }, select: { productId: true } })
  const variant = input.listingVariantId ? await client.storeListingVariant.findFirst({ where: { id: input.listingVariantId, storeListingId: input.listingId }, select: { variantId: true } }) : null
  if (!listing || (input.listingVariantId && !variant)) throw new CartError("ITEM_UNAVAILABLE")
  const item = { productId: listing.productId, variantId: variant?.variantId ?? null }

  const candidates = (await loadCandidates(client, [item])).get(itemKey(item)) ?? []
  if (!candidates.length) throw new CartError("ITEM_UNAVAILABLE")
  if (input.installation && !(await loadInstallationFees(client, [item.productId])).has(item.productId)) throw new CartError("NO_INSTALLATION")

  // Touched on every add, so a basket left alone can be cleared out by its age
  const cart = await client.cart.upsert({
    where: { sessionCartId },
    create: { sessionCartId },
    update: { updatedAt: new Date() },
    select: { id: true, items: { select: lineSelect } },
  })
  const existing = cart.items.find((line) => itemKey(lineItem(line)) === itemKey(item))
  const otherStores = new Set(cart.items.filter((line) => line !== existing).map((line) => line.storeListing.organizationId))

  const chosen = chooseCandidate(candidates, { current: existing && rowKey(lineRow(existing)), stores: otherStores, requested: rowKey(input) })
  if (!chosen) throw new CartError("OUT_OF_STOCK")

  const before = existing?.quantity ?? 0
  const quantity = Math.min(before + input.quantity, limit(chosen))
  const row = { storeListingId: chosen.listingId, storeListingVariantId: chosen.listingVariantId, ...(input.installation && { withInstallation: true }) }
  if (existing) await client.cartItem.update({ where: { id: existing.id }, data: { ...row, quantity } })
  else await client.cartItem.create({ data: { cartId: cart.id, ...row, quantity } })

  return { quantity, added: Math.max(quantity - before, 0), capped: before + input.quantity > quantity, count: await countCartItems(client, sessionCartId) }
}

// Sets a line's quantity, capped at what its store has; 0 removes it
export async function setCartItemQuantity(client: Client, sessionCartId: string, lineId: string, quantity: number) {
  const line = await client.cartItem.findFirst({ where: { id: lineId, cart: { sessionCartId } }, select: lineSelect })
  if (!line) throw new CartError("LINE_NOT_FOUND")

  if (quantity <= 0) {
    await client.cartItem.delete({ where: { id: line.id } })
    return { quantity: 0, capped: false, count: await countCartItems(client, sessionCartId) }
  }

  const candidates = (await loadCandidates(client, [lineItem(line)])).get(itemKey(lineItem(line))) ?? []
  const current = candidates.find((candidate) => rowKey(candidate) === rowKey(lineRow(line)))
  // A line whose store has stopped selling it is moved or dropped when the basket is next shown (loadCart)
  const capped = Math.min(quantity, current ? limit(current) : MAX_LINE_QUANTITY)
  await client.cartItem.update({ where: { id: line.id }, data: { quantity: capped } })
  return { quantity: capped, capped: capped < quantity, count: await countCartItems(client, sessionCartId) }
}

// Adds installation of every unit on a line to it, or takes it off
export async function setCartItemInstallation(client: Client, sessionCartId: string, lineId: string, withInstallation: boolean) {
  const line = await client.cartItem.findFirst({ where: { id: lineId, cart: { sessionCartId } }, select: lineSelect })
  if (!line) throw new CartError("LINE_NOT_FOUND")
  const { productId } = line.storeListing
  if (withInstallation && !(await loadInstallationFees(client, [productId])).has(productId)) throw new CartError("NO_INSTALLATION")
  await client.cartItem.update({ where: { id: line.id }, data: { withInstallation } })
}

export async function removeCartItem(client: Client, sessionCartId: string, lineId: string) {
  await client.cartItem.deleteMany({ where: { id: lineId, cart: { sessionCartId } } })
  return { count: await countCartItems(client, sessionCartId) }
}

export async function clearCart(client: Client, sessionCartId: string) {
  await client.cartItem.deleteMany({ where: { cart: { sessionCartId } } })
}

const viewSelect = {
  ...lineSelect,
  storeListing: { select: { organizationId: true, productId: true, product: { select: { name: true, slug: true, images: true } } } },
  storeListingVariant: {
    select: {
      variantId: true,
      variant: { select: { images: true, variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } } } },
    },
  },
} satisfies Prisma.CartItemSelect

export interface CartLine {
  id: string
  listingId: string
  listingVariantId: string | null
  productName: string
  productSlug: string
  variantId: string | null
  variantDescription: string | null
  image: string | null
  quantity: number
  // What the line's store has, up to MAX_LINE_QUANTITY
  maxQuantity: number
  // GHS with tax when it's on, as the shelf shows it; null without a rate to sell at
  unitGhs: string | null
  // What the order would charge for the line: its GHS total plus its tax
  totalGhs: string | null
  // Installing one unit, with tax when it's on; null when the product doesn't offer it (or without a rate to sell at)
  installationUnitGhs: string | null
  withInstallation: boolean
  // What the order would charge for installing every unit, with its tax; null without installation
  installationGhs: string | null
}

export interface CartView {
  lines: CartLine[]
  // What changed since the customer last looked, e.g. "Only 2 of Tee (Size: M) left, so we've lowered the quantity."
  notices: string[]
  count: number
  // Null without a rate to sell at
  totals: {
    // Before tax, which is what the free-delivery threshold compares with (quoteDelivery)
    subtotalGhs: string
    // Null when tax is off. Includes the installation's.
    taxGhs: string | null
    // Installation with its tax; null when no line has it
    installationGhs: string | null
    // With tax and installation, before delivery
    totalGhs: string
  } | null
}

const EMPTY: CartView = { lines: [], notices: [], count: 0, totals: null }

// The basket as it is now: every line checked against the stores, and moved, lowered or dropped (and saved so) when
// its store can no longer sell it as it was, with a notice saying so. Priced at today's rate.
export async function loadCart(client: Client, sessionCartId: string, pricing: PricingContext | null): Promise<CartView> {
  const cart = await client.cart.findUnique({ where: { sessionCartId }, select: { items: { orderBy: { createdAt: "asc" }, select: viewSelect } } })
  if (!cart?.items.length) return EMPTY

  const candidates = await loadCandidates(client, cart.items.map(lineItem))
  const fees = await loadInstallationFees(client, [...new Set(cart.items.map((line) => line.storeListing.productId))])
  const notices: string[] = []
  const stores = new Set<string>()
  const kept: {
    line: (typeof cart.items)[number]
    chosen: Candidate
    quantity: number
    variantDescription: string | null
    fee: Prisma.Decimal | null
    withInstallation: boolean
  }[] = []

  for (const line of cart.items) {
    const variantDescription = line.storeListingVariant ? describeVariant(line.storeListingVariant.variant.variantValues) : null
    const name = line.storeListing.product.name
    const label = variantDescription ? `${name} (${variantDescription})` : name
    const options = candidates.get(itemKey(lineItem(line))) ?? []
    const chosen = chooseCandidate(options, { current: rowKey(lineRow(line)), stores })

    if (!chosen) {
      // deleteMany, not delete: two loads at once (a prefetch) may both drop it
      await client.cartItem.deleteMany({ where: { id: line.id } })
      notices.push(options.length ? `${label} has sold out, so we've taken it out of your basket.` : `${label} is no longer on sale, so we've taken it out of your basket.`)
      continue
    }

    const quantity = Math.min(line.quantity, limit(chosen))
    if (rowKey(chosen) !== rowKey(lineRow(line)) || quantity !== line.quantity) {
      await client.cartItem.updateMany({ where: { id: line.id }, data: { storeListingId: chosen.listingId, storeListingVariantId: chosen.listingVariantId, quantity } })
    }
    if (quantity < line.quantity) notices.push(`Only ${quantity} of ${label} ${quantity === 1 ? "is" : "are"} left, so we've lowered the quantity.`)

    const fee = fees.get(line.storeListing.productId) ?? null
    if (line.withInstallation && !fee) {
      await client.cartItem.updateMany({ where: { id: line.id }, data: { withInstallation: false } })
      notices.push(`Installation is no longer offered for ${label}, so we've taken it off.`)
    }
    stores.add(chosen.storeId)
    kept.push({ line, chosen, quantity, variantDescription, fee, withInstallation: line.withInstallation && !!fee })
  }

  if (!kept.length) return { ...EMPTY, notices }

  const rate = pricing && new Prisma.Decimal(pricing.rate.rate)
  const priced =
    pricing &&
    rate &&
    priceOrder({
      lines: kept.map(({ chosen, quantity, fee, withInstallation }) => ({ unitPriceUsd: chosen.priceUsd, quantity, installationUnitGhs: withInstallation ? fee : null })),
      exchangeRate: rate,
      shippingGhs: new Prisma.Decimal(0),
      discount: null,
      tax: pricing.tax,
    })

  return {
    lines: kept.map(({ line, chosen, quantity, variantDescription, fee, withInstallation }, index) => {
      const amounts = priced?.lines[index]
      return {
        id: line.id,
        listingId: chosen.listingId,
        listingVariantId: chosen.listingVariantId,
        productName: line.storeListing.product.name,
        productSlug: line.storeListing.product.slug,
        variantId: line.storeListingVariant?.variantId ?? null,
        variantDescription,
        image: line.storeListingVariant?.variant.images[0] ?? line.storeListing.product.images[0] ?? null,
        quantity,
        maxQuantity: limit(chosen),
        unitGhs: rate ? shelfPrice(chosen.priceUsd, rate, pricing.tax?.rate ?? null).incTaxGhs.toFixed(2) : null,
        totalGhs: amounts ? amounts.totalPriceGhs.plus(amounts.taxGhs).toFixed(2) : null,
        installationUnitGhs: fee && pricing ? withTax(fee, pricing.tax?.rate ?? null).toFixed(2) : null,
        withInstallation,
        installationGhs: amounts?.installationUnitGhs ? amounts.installationTotalGhs.plus(amounts.installationTaxGhs).toFixed(2) : null,
      }
    }),
    notices,
    count: kept.reduce((total, { quantity }) => total + quantity, 0),
    totals: priced && {
      subtotalGhs: priced.subtotalGhs.toFixed(2),
      taxGhs: pricing.tax ? priced.taxGhs.toFixed(2) : null,
      installationGhs: priced.installationGhs.gt(0) ? sumInstallation(priced.lines).toFixed(2) : null,
      totalGhs: priced.totalGhs.toFixed(2),
    },
  }
}

// Installation on every line, with its tax
export function sumInstallation(lines: { installationTotalGhs: Prisma.Decimal; installationTaxGhs: Prisma.Decimal }[]) {
  return lines.reduce((sum, line) => sum.plus(line.installationTotalGhs).plus(line.installationTaxGhs), new Prisma.Decimal(0))
}
