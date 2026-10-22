import type { Condition, SpecType } from "@workspace/db/enums"

// What a product card shows, and what the listing pages filter and sort by. Plain values only (prices as strings), so
// it can be cached and passed to client components. Built by lib/data/product-cards.ts.

// A row with stock to sell (`left` is set when tracked stock is down to the low-stock threshold), or one without: then
// whether more is on its way (an open purchase order), and the day the earliest delivery is expected, if known
export type StockState = { kind: "in-stock"; left: number | null } | { kind: "out"; onOrder: boolean; dueOn: string | null }

// One thing customers can buy: a product without variants, or one variant. Of all the stores selling it, the one
// customers buy from (stores are never shown): see pickOffer.
export interface Offer {
  variantId: string | null
  // The variant's option values (VariantOptionValue ids); empty without variants
  optionValueIds: string[]
  listingId: string
  listingVariantId: string | null
  priceUsd: string
  // Only when above the price
  compareAtUsd: string | null
  stock: StockState
  image: string | null
}

export interface SpecValue {
  specId: string
  name: string
  type: SpecType
  // As shown: "4MP", "30 m", "Yes"
  label: string
  // In the filter's URL: a slug of the label, the number, or yes/no
  key: string
  // Filter values are listed in this order: the option's position, the number, yes before no, or the text
  sort: number | string
}

export interface VariantOptionData {
  name: string
  values: { id: string; value: string }[]
}

export interface ProductCardData {
  id: string
  name: string
  slug: string
  brand: { id: string; name: string; slug: string }
  categoryId: string
  condition: Condition
  image: string | null
  isFeatured: boolean
  createdAt: number
  // Its published reviews' average (0.00 without any) and count
  rating: string
  numReviews: number
  // The product's spec values, its category's top one's specs first
  specs: SpecValue[]
  // Only the values some offer has
  options: VariantOptionData[]
  // The card's default first: the cheapest in stock, else the first due, else the cheapest
  offers: Offer[]
}

export interface ShelfPrice {
  // What customers pay for one, with tax when it's on
  ghs: string
  // Set only when tax is on
  exTaxGhs: string | null
  wasGhs: string | null
}

export type PricedOffer = Offer & { price: ShelfPrice | null }

export type PricedCard = Omit<ProductCardData, "offers"> & { offers: PricedOffer[] }

export const isInStock = (offer: Offer) => offer.stock.kind === "in-stock"

// Which of several candidates for the same thing is the offer, and in what order a product's offers go: in stock
// before out, then (out of stock) one with a delivery due before one without, the earliest first, then the cheapest.
// Listing id breaks ties so the choice is the same on every load.
export function compareOffers(a: Offer, b: Offer) {
  if (isInStock(a) !== isInStock(b)) return isInStock(a) ? -1 : 1
  if (a.stock.kind === "out" && b.stock.kind === "out") {
    const dueA = a.stock.onOrder ? (a.stock.dueOn ?? "9999") : null
    const dueB = b.stock.onOrder ? (b.stock.dueOn ?? "9999") : null
    if (dueA !== dueB) return dueA === null ? 1 : dueB === null ? -1 : dueA < dueB ? -1 : 1
  }
  // Only an ordering: two-decimal prices compare exactly as numbers. Don't do sums this way (see Orders and money).
  const byPrice = Number(a.priceUsd) - Number(b.priceUsd)
  return byPrice !== 0 ? byPrice : a.listingId < b.listingId ? -1 : a.listingId > b.listingId ? 1 : 0
}

// The offer for each variant (or the product), across every store selling it, in compareOffers order
export function pickOffers(candidates: Offer[]): Offer[] {
  const best = new Map<string | null, Offer>()
  for (const offer of candidates) {
    const current = best.get(offer.variantId)
    if (!current || compareOffers(offer, current) < 0) best.set(offer.variantId, offer)
  }
  return [...best.values()].sort(compareOffers)
}
