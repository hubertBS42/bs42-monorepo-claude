import "server-only"

import { Prisma } from "@workspace/db/client"
import type { Condition } from "@workspace/db/enums"
import { getEnumParam, getPositiveIntegerParam, getStringParam, type SearchParamValue } from "@workspace/utils/search-params"

import { CONDITION_LABELS } from "@/lib/conditions"
import { slugifyValue } from "@/lib/data/product-cards"
import { isInStock, type PricedCard } from "@/lib/product-cards"

// The listing pages' filters, sorting and paging, read from the URL and applied to a page's products (all loaded by
// loadProductCards). Within a filter any ticked value matches; across filters every one must.

export type SearchParams = Record<string, SearchParamValue>

export const SORTS = ["featured", "price-asc", "price-desc", "newest", "top-rated"] as const
export type Sort = (typeof SORTS)[number]
export const SORT_LABELS: Record<Sort, string> = {
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  newest: "Newest",
  "top-rated": "Top rated",
}

export const PAGE_SIZE = 24

const conditionKey = (condition: Condition) => condition.toLowerCase().replaceAll("_", "-")

// The page's own parameters; a spec whose name slugs to one of them gets a "spec-" prefix
const RESERVED_PARAMS = new Set(["q", "brand", "condition", "stock", "min", "max", "sort", "page"])

// A spec the page can filter by: the category's, and those of the categories above it, in that order
export interface SpecFilter {
  specId: string
  name: string
  param: string
}

export function specFilters(specs: { id: string; name: string }[]): SpecFilter[] {
  return specs.map(({ id, name }) => {
    const slug = slugifyValue(name)
    return { specId: id, name, param: RESERVED_PARAMS.has(slug) ? `spec-${slug}` : slug }
  })
}

export interface CatalogueQuery {
  brands: Set<string>
  conditions: Set<string>
  // By the spec's param
  specs: Map<string, Set<string>>
  inStock: boolean
  // GHS, as shown
  min: Prisma.Decimal | null
  max: Prisma.Decimal | null
  sort: Sort
  page: number
}

const values = (value: SearchParamValue) => new Set((Array.isArray(value) ? value : value ? [value] : []).filter(Boolean))

function amountParam(value: SearchParamValue) {
  const text = getStringParam(value)?.trim()
  return text && /^\d+(\.\d{1,2})?$/.test(text) ? new Prisma.Decimal(text) : null
}

export function parseQuery(params: SearchParams, filters: SpecFilter[]): CatalogueQuery {
  return {
    brands: values(params.brand),
    conditions: values(params.condition),
    specs: new Map(filters.flatMap((filter) => (values(params[filter.param]).size ? [[filter.param, values(params[filter.param])] as const] : []))),
    inStock: getStringParam(params.stock) === "in",
    min: amountParam(params.min),
    max: amountParam(params.max),
    sort: getEnumParam(params.sort, SORTS) ?? "featured",
    page: getPositiveIntegerParam(params.page, 1),
  }
}

// A card's price is its first offer's, which is the one it shows first
const cardPrice = (card: PricedCard) => (card.offers[0]?.price ? new Prisma.Decimal(card.offers[0].price.ghs) : null)

type Group = "brand" | "condition" | "stock" | "price" | { param: string }

// Whether a card passes every filter, leaving one out (for that filter's own counts)
function matches(card: PricedCard, query: CatalogueQuery, filters: SpecFilter[], except?: Group) {
  const skip = (group: Group) => except !== undefined && (typeof group === "string" ? except === group : typeof except !== "string" && except.param === group.param)

  if (!skip("brand") && query.brands.size && !query.brands.has(card.brand.slug)) return false
  if (!skip("condition") && query.conditions.size && !query.conditions.has(conditionKey(card.condition))) return false
  if (!skip("stock") && query.inStock && !card.offers.some(isInStock)) return false
  if (!skip("price") && (query.min || query.max)) {
    const price = cardPrice(card)
    if (!price || (query.min && price.lt(query.min)) || (query.max && price.gt(query.max))) return false
  }
  for (const filter of filters) {
    const wanted = query.specs.get(filter.param)
    if (!wanted || skip({ param: filter.param })) continue
    const value = card.specs.find((spec) => spec.specId === filter.specId)
    if (!value || !wanted.has(value.key)) return false
  }
  return true
}

export interface FacetValue {
  key: string
  label: string
  count: number
  selected: boolean
}

export interface Facet {
  param: string
  name: string
  values: FacetValue[]
}

export interface Facets {
  // Brand, condition, then each spec
  lists: Facet[]
  inStockCount: number
  hasPrices: boolean
}

// Each filter's values with how many products each would show, given the other filters. A filter is left out when no
// product has a value for it, or when it can't narrow the list (every product has the same value) and none is ticked.
export function getFacets(cards: PricedCard[], query: CatalogueQuery, filters: SpecFilter[]): Facets {
  const list = (param: string, name: string, group: Group, selected: Set<string>, valueOf: (card: PricedCard) => { key: string; label: string; sort: number | string } | undefined): Facet | null => {
    const counts = new Map<string, FacetValue & { sort: number | string }>()
    let withValue = 0
    for (const card of cards) {
      const value = valueOf(card)
      if (!value) continue
      withValue++
      const entry = counts.get(value.key) ?? { ...value, count: 0, selected: selected.has(value.key) }
      if (matches(card, query, filters, group)) entry.count++
      counts.set(value.key, entry)
    }
    const values = [...counts.values()].sort((a, b) => (typeof a.sort === "number" && typeof b.sort === "number" ? a.sort - b.sort : String(a.sort).localeCompare(String(b.sort))))
    if (!values.length) return null
    const narrows = values.length > 1 || withValue < cards.length
    if (!narrows && !values.some((value) => value.selected)) return null
    return { param, name, values: values.map(({ key, label, count, selected }) => ({ key, label, count, selected })) }
  }

  const conditionOrder = Object.keys(CONDITION_LABELS) as Condition[]
  const lists = [
    list("brand", "Brand", "brand", query.brands, (card) => ({ key: card.brand.slug, label: card.brand.name, sort: card.brand.name.toLowerCase() })),
    list("condition", "Condition", "condition", query.conditions, (card) => ({
      key: conditionKey(card.condition),
      label: CONDITION_LABELS[card.condition],
      sort: conditionOrder.indexOf(card.condition),
    })),
    ...filters.map((filter) =>
      list(filter.param, filter.name, { param: filter.param }, query.specs.get(filter.param) ?? new Set(), (card) => card.specs.find((spec) => spec.specId === filter.specId))
    ),
  ].filter((facet) => facet !== null)

  return {
    lists,
    inStockCount: cards.filter((card) => card.offers.some(isInStock) && matches(card, query, filters, "stock")).length,
    hasPrices: cards.some((card) => card.offers[0]?.price),
  }
}

function compareCards(sort: Sort) {
  const byName = (a: PricedCard, b: PricedCard) => a.name.localeCompare(b.name)
  // Without prices (no rate), USD gives the same order
  const price = (card: PricedCard) => cardPrice(card) ?? new Prisma.Decimal(card.offers[0]!.priceUsd)
  switch (sort) {
    case "featured":
      return (a: PricedCard, b: PricedCard) => Number(b.isFeatured) - Number(a.isFeatured) || Number(isInStock(b.offers[0]!)) - Number(isInStock(a.offers[0]!)) || byName(a, b)
    case "price-asc":
      return (a: PricedCard, b: PricedCard) => price(a).comparedTo(price(b)) || byName(a, b)
    case "price-desc":
      return (a: PricedCard, b: PricedCard) => price(b).comparedTo(price(a)) || byName(a, b)
    case "newest":
      return (a: PricedCard, b: PricedCard) => b.createdAt - a.createdAt || byName(a, b)
    case "top-rated":
      // Ratings are two-place averages, so comparing them as numbers is exact; then the more reviewed first
      return (a: PricedCard, b: PricedCard) => Number(b.rating) - Number(a.rating) || b.numReviews - a.numReviews || byName(a, b)
  }
}

export function applyQuery(cards: PricedCard[], query: CatalogueQuery, filters: SpecFilter[]) {
  const matching = cards.filter((card) => matches(card, query, filters)).sort(compareCards(query.sort))
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE))
  const page = Math.min(query.page, pageCount)
  return { items: matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: matching.length, page, pageCount }
}

// The page's URL with one parameter changed (a value ticked or unticked, or set), back on page 1
export function hrefWith(pathname: string, params: SearchParams, change: { toggle: [string, string] } | { set: Record<string, string | null> }) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) for (const item of Array.isArray(value) ? value : value ? [value] : []) next.append(key, item)
  next.delete("page")

  if ("toggle" in change) {
    const [key, value] = change.toggle
    if (next.getAll(key).includes(value)) next.delete(key, value)
    else next.append(key, value)
  } else {
    for (const [key, value] of Object.entries(change.set)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
  }
  const query = next.toString()
  return query ? `${pathname}?${query}` : pathname
}

// The same URL on another page
export function pageHref(pathname: string, params: SearchParams, page: number) {
  const href = hrefWith(pathname, params, { set: {} })
  if (page === 1) return href
  return `${href}${href.includes("?") ? "&" : "?"}page=${page}`
}
