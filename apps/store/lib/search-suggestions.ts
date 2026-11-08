import type { PricedOffer } from "@/lib/product-cards"

// Shared by /search and the header's suggestions. Shorter searches match too much to be useful
export const MIN_SEARCH_LENGTH = 2
export const MAX_SEARCH_LENGTH = 100
export const SUGGESTIONS_SHOWN = 6

export type SearchSuggestion = { id: string; name: string; slug: string; brandName: string; image: string | null; offer: PricedOffer }
export type SearchSuggestions = { items: SearchSuggestion[]; total: number }
