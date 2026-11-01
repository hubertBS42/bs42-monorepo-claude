import { isInStock, type ProductCardData } from "@/lib/product-cards"

// "You may also like": products like this one, from the cards customers can buy. Pure, so it can be tested.

// How many spec values two products share (the same spec with the same value)
function sharedSpecs(a: ProductCardData, b: ProductCardData) {
  const values = new Set(a.specs.map((spec) => `${spec.specId}:${spec.key}`))
  return b.specs.filter((spec) => values.has(`${spec.specId}:${spec.key}`)).length
}

// How far apart two prices are, as a ratio, so GH₵100 against GH₵200 counts as GH₵1,000 against GH₵2,000
function priceDistance(a: ProductCardData, b: ProductCardData) {
  const first = Number(a.offers[0]!.priceUsd)
  const second = Number(b.offers[0]!.priceUsd)
  return first > 0 && second > 0 ? Math.abs(Math.log(first / second)) : Number.POSITIVE_INFINITY
}

// Up to `count` of the candidates, leaving out the product and `exclude` (what it pairs with): those sharing the most
// spec values first, then in stock before out of stock, then the nearest in price. `wider` tops the list up when the
// product's own category has too few, ranked the same way after them.
export function similarProducts(product: ProductCardData, candidates: ProductCardData[], wider: ProductCardData[], exclude: Set<string>, count: number) {
  const rank = (cards: ProductCardData[], taken: Set<string>) =>
    cards
      .filter((card) => card.id !== product.id && !exclude.has(card.id) && !taken.has(card.id))
      .map((card) => ({ card, shared: sharedSpecs(product, card), inStock: isInStock(card.offers[0]!), distance: priceDistance(product, card) }))
      .sort((a, b) => b.shared - a.shared || Number(b.inStock) - Number(a.inStock) || a.distance - b.distance || a.card.name.localeCompare(b.card.name))
      .map(({ card }) => card)

  const first = rank(candidates, new Set()).slice(0, count)
  if (first.length >= count) return first
  return [...first, ...rank(wider, new Set(first.map((card) => card.id)))].slice(0, count)
}
