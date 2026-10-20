import Link from "next/link"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { FilterPanel } from "@/components/catalogue/filter-panel"
import { FiltersSheet } from "@/components/catalogue/filters-sheet"
import { SortSelect } from "@/components/catalogue/sort-select"
import { ProductCard } from "@/components/product-card"
import { applyQuery, getFacets, hrefWith, pageHref, parseQuery, SORT_LABELS, SORTS, type SearchParams, type SpecFilter } from "@/lib/catalogue-filters"
import { formatGhs } from "@/lib/money"
import type { PricedCard } from "@/lib/product-cards"

// A page of products with filters, sorting and paging, all in the URL: a category's, a brand's or a search's
export function ProductListing({ pathname, params, cards, filters = [] }: { pathname: string; params: SearchParams; cards: PricedCard[]; filters?: SpecFilter[] }) {
  const query = parseQuery(params, filters)
  const facets = getFacets(cards, query, filters)
  const { items, total, page, pageCount } = applyQuery(cards, query, filters)

  // What's ticked, each with a link that unticks it
  const active = [
    ...(query.inStock ? [{ label: "In stock", href: hrefWith(pathname, params, { set: { stock: null } }) }] : []),
    ...(query.min || query.max
      ? [
          {
            label:
              query.min && query.max
                ? `${formatGhs(query.min.toString())} – ${formatGhs(query.max.toString())}`
                : query.min
                  ? `From ${formatGhs(query.min.toString())}`
                  : `Up to ${formatGhs(query.max!.toString())}`,
            href: hrefWith(pathname, params, { set: { min: null, max: null } }),
          },
        ]
      : []),
    ...facets.lists.flatMap((facet) => facet.values.filter((value) => value.selected).map((value) => ({ label: value.label, href: hrefWith(pathname, params, { toggle: [facet.param, value.key] }) }))),
  ]
  const clearAll = hrefWith(pathname, params, {
    set: Object.fromEntries(
      Object.keys(params)
        .filter((key) => key !== "q" && key !== "sort")
        .map((key) => [key, null])
    ),
  })
  const sortOptions = SORTS.map((value) => ({ value, label: SORT_LABELS[value], href: hrefWith(pathname, params, { set: { sort: value === "featured" ? null : value } }) }))

  const panel = <FilterPanel pathname={pathname} params={params} query={query} facets={facets} />

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
      <aside className="hidden lg:block" aria-label="Filters">
        {panel}
      </aside>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <FiltersSheet activeCount={active.length}>{panel}</FiltersSheet>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "product" : "products"}
          </p>
          <div className="ml-auto">
            <SortSelect value={query.sort} options={sortOptions} />
          </div>
        </div>

        {active.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {active.map((filter) => (
              <Link key={filter.href} href={filter.href} scroll={false} className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-sm hover:bg-muted">
                {filter.label}
                <X className="size-3.5" aria-label="Remove" />
              </Link>
            ))}
            <Link href={clearAll} scroll={false} className="text-sm font-medium underline underline-offset-4">
              Clear all
            </Link>
          </div>
        )}

        {items.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {items.map((card) => (
              <li key={card.id}>
                <ProductCard card={card} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-semibold">No products match these filters</p>
            {active.length > 0 && (
              <Button render={<Link href={clearAll} />} variant="outline" className="mt-4">
                Clear filters
              </Button>
            )}
          </div>
        )}

        {pageCount > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pages">
            {page > 1 ? (
              <Button render={<Link href={pageHref(pathname, params, page - 1)} />} variant="outline" size="sm">
                <ChevronLeft />
                Previous
              </Button>
            ) : null}
            <span className="text-sm text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Button render={<Link href={pageHref(pathname, params, page + 1)} />} variant="outline" size="sm">
                Next
                <ChevronRight />
              </Button>
            ) : null}
          </nav>
        )}
      </div>
    </div>
  )
}
