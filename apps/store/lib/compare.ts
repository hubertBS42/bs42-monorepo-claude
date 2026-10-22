import { CONDITION_LABELS } from "./conditions"
import type { PricedCard } from "./product-cards"

// Comparing products: what the /compare page shows, worked out from the products' cards. Pure (the comparison bar
// imports MAX_COMPARE), so it can be tested without a database.

export const MAX_COMPARE = 4

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The page's ?ids=: product ids, in order, each once, at most MAX_COMPARE
export function parseCompareIds(value: string | null | undefined): string[] {
  const ids = (value ?? "").split(",").filter((id) => UUID.test(id))
  return [...new Set(ids.map((id) => id.toLowerCase()))].slice(0, MAX_COMPARE)
}

export interface CompareSpec {
  id: string
  name: string
}

export interface CompareFacts {
  weightKg: string | null
  dimensions: string | null
}

export interface CompareRow {
  key: string
  name: string
  // Per product, in the cards' order; null where a product has none
  values: (string | null)[]
  // Whether the products' values aren't all the same
  differs: boolean
}

// One row per spec of the category (top category's first, as given), then condition, weight and dimensions. A row
// no product has a value for is left out; a missing value counts as a difference.
export function compareRows(cards: PricedCard[], specs: CompareSpec[], facts: CompareFacts[]): CompareRow[] {
  const row = (key: string, name: string, values: (string | null)[]): CompareRow[] => (values.some((value) => value !== null) ? [{ key, name, values, differs: new Set(values).size > 1 }] : [])

  return [
    ...specs.flatMap((spec) =>
      row(
        `spec:${spec.id}`,
        spec.name,
        cards.map((card) => card.specs.find((value) => value.specId === spec.id)?.label ?? null)
      )
    ),
    ...row(
      "condition",
      "Condition",
      cards.map((card) => CONDITION_LABELS[card.condition])
    ),
    ...row(
      "weight",
      "Weight",
      facts.map((fact) => (fact.weightKg ? `${fact.weightKg} kg` : null))
    ),
    ...row(
      "dimensions",
      "Dimensions",
      facts.map((fact) => fact.dimensions)
    ),
  ]
}

// The cheapest of a product's priced offers, for "From GHS …" on a product with variants. Ordering only: two-decimal
// prices compare exactly as numbers (no sums here).
export function lowestPrice(card: PricedCard) {
  return card.offers.reduce<PricedCard["offers"][number] | null>((lowest, offer) => (offer.price && (!lowest?.price || Number(offer.price.ghs) < Number(lowest.price.ghs)) ? offer : lowest), null)
}
