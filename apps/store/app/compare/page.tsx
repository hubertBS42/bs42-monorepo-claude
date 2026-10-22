import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Scale } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { getStringParam } from "@workspace/utils/search-params"

import { CompareTable } from "@/components/compare/compare-table"
import type { SearchParams } from "@/lib/catalogue-filters"
import { compareRows, parseCompareIds } from "@/lib/compare"
import { categoryHref, categoryPath, getCategorySpecs, getCategoryTree } from "@/lib/data/categories"
import { getProductDetails } from "@/lib/data/product-details"
import { queryProductCards } from "@/lib/data/product-cards"
import { priceCards } from "@/lib/pricing"
import { getShelfPricing } from "@/lib/settings"

export const metadata: Metadata = { title: "Compare products", robots: { index: false } }

// The products in ?ids= side by side, at today's prices: one category's (the first product's decides), so they share
// its specs. Products no longer on sale, or from another category, are left out with a note.
export default async function ComparePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ids = parseCompareIds(getStringParam((await searchParams).ids))
  const [cards, pricing, tree] = await Promise.all([ids.length ? queryProductCards({ productIds: ids }) : [], getShelfPricing(), getCategoryTree()])

  const byId = new Map(priceCards(cards, pricing).map((card) => [card.id, card]))
  const found = ids.flatMap((id) => byId.get(id) ?? [])
  const categoryId = found[0]?.categoryId
  const shown = found.filter((card) => card.categoryId === categoryId)
  const leftOut = ids.length - shown.length

  const path = categoryId ? categoryPath(tree, categoryId) : []
  const [specs, details] = await Promise.all([getCategorySpecs(path.map((node) => node.id)), Promise.all(shown.map((card) => getProductDetails(card.id)))])
  const rows = compareRows(
    shown,
    specs,
    details.map((detail) => detail.facts)
  )
  const category = path.at(-1)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <header className="mb-6 flex flex-col gap-2">
        {category && categoryId && (
          <Link href={categoryHref(tree, categoryId)} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            {category.name}
          </Link>
        )}
        <h1 className="text-3xl font-bold tracking-tight">Compare {category ? category.name : "products"}</h1>
        {leftOut > 0 && (
          <p className="text-sm text-muted-foreground">
            {leftOut === 1 ? "One product isn't" : `${leftOut} products aren't`} shown: no longer on sale{shown.length ? `, or not in ${category?.name ?? "this category"}` : ""}.
          </p>
        )}
      </header>

      {shown.length >= 2 ? (
        <CompareTable cards={shown} rows={rows} />
      ) : (
        <Card className="max-w-xl">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Scale className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">{shown.length ? "Pick another product to compare" : "Nothing to compare yet"}</p>
            <p className="max-w-sm text-sm text-muted-foreground">Tick “Compare” on up to 4 products from the same category, then compare them here.</p>
            <Button render={<Link href={categoryId ? categoryHref(tree, categoryId) : "/"} />} variant="outline" size="sm" className="mt-2">
              {category ? `Back to ${category.name}` : "Start shopping"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
