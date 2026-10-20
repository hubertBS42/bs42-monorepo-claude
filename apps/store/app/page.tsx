import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { ProductCard } from "@/components/product-card"
import { SearchForm } from "@/components/search-form"
import { categoryHref, getCategoryTree } from "@/lib/data/categories"
import { loadProductCards } from "@/lib/data/product-cards"
import { isInStock } from "@/lib/product-cards"
import { priceCards } from "@/lib/pricing"
import { getAppSettings, getShelfPricing, getStoreName } from "@/lib/settings"

const FEATURED_COUNT = 8

export default async function HomePage() {
  const [settings, storeName, tree, featured, pricing] = await Promise.all([getAppSettings(), getStoreName(), getCategoryTree(), loadProductCards({ featured: true }), getShelfPricing()])
  // In stock first, then by name, so the homepage doesn't open on things nobody can buy
  const cards = priceCards([...featured].sort((a, b) => Number(isInStock(b.offers[0]!)) - Number(isInStock(a.offers[0]!)) || a.name.localeCompare(b.name)).slice(0, FEATURED_COUNT), pricing)

  return (
    <>
      <section className="bg-muted">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-14 lg:px-6 lg:py-20">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">{storeName}</h1>
          {settings.storeDescription && <p className="max-w-xl text-lg text-muted-foreground">{settings.storeDescription}</p>}
          <SearchForm className="max-w-xl" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-12 lg:px-6">
        <h2 className="mb-5 text-2xl font-bold tracking-tight md:text-3xl">Shop by category</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tree.roots.map((root) => (
            <li key={root.id} className="flex flex-col rounded-xl border p-5">
              <Link href={categoryHref(tree, root.id)} className="group flex items-center justify-between gap-2 font-semibold">
                <span className="text-lg">{root.name}</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <p className="text-sm text-muted-foreground">
                {root.productCount} {root.productCount === 1 ? "product" : "products"}
              </p>
              {root.children.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {root.children.map((child) => (
                    <li key={child.id}>
                      <Link href={categoryHref(tree, child.id)} className="inline-flex rounded-full bg-muted px-3 py-1 text-sm hover:bg-accent">
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      {cards.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12 lg:px-6">
          <h2 className="mb-5 text-2xl font-bold tracking-tight md:text-3xl">Featured</h2>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <li key={card.id}>
                <ProductCard card={card} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
