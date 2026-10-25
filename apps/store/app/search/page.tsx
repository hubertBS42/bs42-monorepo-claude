import type { Metadata } from "next"
import { getStringParam } from "@workspace/utils/search-params"

import { ProductListing } from "@/components/catalogue/product-listing"
import { SearchForm } from "@/components/search-form"
import type { SearchParams } from "@/lib/catalogue-filters"
import { loadProductCards } from "@/lib/data/product-cards"
import { priceCards } from "@/lib/pricing"
import { getShelfPricing } from "@/lib/settings"

interface SearchPageProps {
  searchParams: Promise<SearchParams>
}

// Shorter searches match too much to be useful
const MIN_SEARCH_LENGTH = 2
const MAX_SEARCH_LENGTH = 100

const searchTerm = (params: SearchParams) => getStringParam(params.q)?.trim().slice(0, MAX_SEARCH_LENGTH) ?? ""

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const q = searchTerm(await searchParams)
  return { title: q ? `Search: ${q}` : "Search", robots: { index: false } }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const q = searchTerm(params)
  const searching = q.length >= MIN_SEARCH_LENGTH
  const [cards, pricing] = searching ? await Promise.all([loadProductCards({ search: q }), getShelfPricing()]) : [[], null]

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 lg:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{searching ? <>Results for “{q}”</> : "Search"}</h1>
        {!searching && <p className="mt-2 text-muted-foreground">Search by product name, SKU or barcode.</p>}
      </header>
      {searching ? (
        cards.length ? (
          <ProductListing pathname="/search" params={params} cards={priceCards(cards, pricing)} />
        ) : (
          <div className="max-w-xl space-y-4">
            <p className="text-muted-foreground">Nothing matches “{q}”. Try another word, or check the spelling.</p>
            <SearchForm defaultValue={q} />
          </div>
        )
      ) : (
        <SearchForm defaultValue={q} className="max-w-xl" />
      )}
    </div>
  )
}
