import { findSuggestions, loadSearchIndex } from "@/lib/data/search-suggestions"
import { priceOffers } from "@/lib/pricing"
import { MAX_SEARCH_LENGTH, MIN_SEARCH_LENGTH, type SearchSuggestions } from "@/lib/search-suggestions"
import { getShelfPricing } from "@/lib/settings"

// The header's search suggestions. Trade prices are worked out in the browser, as on the shelf
export async function GET(request: Request) {
  const search = new URL(request.url).searchParams.get("q")?.trim().slice(0, MAX_SEARCH_LENGTH) ?? ""
  if (search.length < MIN_SEARCH_LENGTH) return Response.json({ items: [], total: 0 } satisfies SearchSuggestions)

  const [index, pricing] = await Promise.all([loadSearchIndex(), getShelfPricing()])
  const { matches, total } = findSuggestions(index, search)
  const body: SearchSuggestions = {
    total,
    items: matches.map(({ codes: _codes, offer, ...entry }) => ({ ...entry, offer: priceOffers([offer], pricing)[0]! })),
  }
  return Response.json(body, { headers: { "Cache-Control": "private, max-age=30" } })
}
