import "server-only"

import { unstable_cache } from "next/cache"
import { prisma } from "@workspace/db"
import { matchesSearch, squashText } from "@workspace/ui/lib/search"

import { queryProductCards } from "@/lib/data/product-cards"
import { isInStock, type Offer } from "@/lib/product-cards"
import { SUGGESTIONS_SHOWN } from "@/lib/search-suggestions"

type IndexEntry = { id: string; name: string; slug: string; brandName: string; image: string | null; offer: Offer; codes: string[] }

// Everything on sale, in a small list that the header's suggestions search in memory, so typing doesn't reach the
// database. Each product's first offer is the one its card opens on.
export const loadSearchIndex = unstable_cache(
  async (): Promise<IndexEntry[]> => {
    const cards = await queryProductCards({ all: true })
    const products = await prisma.product.findMany({
      where: { id: { in: cards.map((card) => card.id) } },
      select: { id: true, sku: true, barcode: true, variants: { select: { sku: true, barcode: true } } },
    })
    const codes = new Map(products.map((product) => [product.id, [product.sku, product.barcode, ...product.variants.flatMap((variant) => [variant.sku, variant.barcode])].filter((code): code is string => !!code)]))
    return cards.map((card) => ({ id: card.id, name: card.name, slug: card.slug, brandName: card.brand.name, image: card.offers[0]!.image ?? card.image, offer: card.offers[0]!, codes: codes.get(card.id) ?? [] }))
  },
  ["store-search-index"],
  { revalidate: 60 }
)

// The same products /search finds (the name, SKU or barcode, including the variants'): what the text identifies exactly
// first, then names that start with it, other names, and SKUs or barcodes that contain it; in stock before out
export function findSuggestions(index: IndexEntry[], search: string) {
  const text = squashText(search)
  const rank = ({ name, codes }: IndexEntry) => {
    const squashed = squashText(name)
    if (squashed === text || codes.some((code) => squashText(code) === text)) return 0
    if (squashed.startsWith(text)) return 1
    return squashed.includes(text) ? 2 : 3
  }
  const matches = index
    .filter((entry) => matchesSearch(entry.name, search) || entry.codes.some((code) => matchesSearch(code, search)))
    .map((entry) => ({ entry, rank: rank(entry) }))
    .sort((a, b) => a.rank - b.rank || Number(isInStock(b.entry.offer)) - Number(isInStock(a.entry.offer)) || a.entry.name.localeCompare(b.entry.name))
  return { matches: matches.slice(0, SUGGESTIONS_SHOWN).map(({ entry }) => entry), total: matches.length }
}
