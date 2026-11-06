import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { BlogPostCard } from "@/components/blog/blog-card"
import { CategoryCarousel } from "@/components/home/category-carousel"
import { CategoryGrid } from "@/components/home/category-grid"
import { HowToOrder } from "@/components/home/how-to-order"
import { TradeBand } from "@/components/home/trade-band"
import { ProductCard } from "@/components/product-card"
import { SearchForm } from "@/components/search-form"
import { getBestSellerIds } from "@/lib/data/best-sellers"
import { getBlogPosts } from "@/lib/data/blog"
import { categoryHref, featuredCategories, getCategoryTree } from "@/lib/data/categories"
import { loadProductCards } from "@/lib/data/product-cards"
import { isInStock } from "@/lib/product-cards"
import { priceCards } from "@/lib/pricing"
import { getAppSettings, getShelfPricing, getStoreName } from "@/lib/settings"

const FEATURED_COUNT = 8
// One row on wide screens; the row shows only when it can fill it
const BEST_SELLERS_COUNT = 4
// The newest posts, one row of cards on wide screens
const BLOG_POSTS = 3

export default async function HomePage() {
  const [settings, storeName, tree, featured, pricing, posts, bestSellerIds] = await Promise.all([
    getAppSettings(),
    getStoreName(),
    getCategoryTree(),
    loadProductCards({ featured: true }),
    getShelfPricing(),
    getBlogPosts(),
    getBestSellerIds(),
  ])
  const slides = featuredCategories(tree).map((node) => ({ id: node.id, name: node.name, description: node.description, image: node.image, href: categoryHref(tree, node.id) }))
  const tiles = tree.roots.map((root) => ({
    id: root.id,
    name: root.name,
    image: root.image,
    href: categoryHref(tree, root.id),
    productCount: root.productCount,
    children: root.children.map((child) => ({ id: child.id, name: child.name, href: categoryHref(tree, child.id) })),
  }))
  // In stock first, then by name, so the homepage doesn't open on things nobody can buy
  const cards = priceCards([...featured].sort((a, b) => Number(isInStock(b.offers[0]!)) - Number(isInStock(a.offers[0]!)) || a.name.localeCompare(b.name)).slice(0, FEATURED_COUNT), pricing)

  // In the order they sold, leaving out what's out of stock or already in Featured products just above
  const shownIds = new Set(cards.map((card) => card.id))
  const bestSellerCards = bestSellerIds.length ? await loadProductCards({ productIds: bestSellerIds }) : []
  const byId = new Map(bestSellerCards.map((card) => [card.id, card]))
  const bestSellers = priceCards(
    bestSellerIds
      .flatMap((id) => byId.get(id) ?? [])
      .filter((card) => !shownIds.has(card.id) && isInStock(card.offers[0]!))
      .slice(0, BEST_SELLERS_COUNT),
    pricing
  )

  return (
    <div className="pb-16">
      {/* Featured categories when there are any, else the store's name and description */}
      {slides.length > 0 ? (
        <section>
          <h1 className="sr-only">{storeName}</h1>
          <CategoryCarousel slides={slides} />
        </section>
      ) : (
        <section className="bg-muted">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-14 lg:px-6 lg:py-20">
            <h1 className="max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">{storeName}</h1>
            {settings.storeDescription && <p className="max-w-xl text-lg text-muted-foreground">{settings.storeDescription}</p>}
            <SearchForm className="max-w-xl" />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pt-12 lg:px-6">
        <SectionTitle>Shop by category</SectionTitle>
        <CategoryGrid tiles={tiles} />
      </section>

      {/* While there's no checkout (Settings' Online Payments off): how to order instead */}
      {!settings.onlinePaymentsEnabled && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:pt-[6vw] lg:px-6">
          <SectionTitle>How to order</SectionTitle>
          <HowToOrder quoteValidityDays={settings.quoteValidityDays} phone={settings.contactPhone} whatsapp={settings.contactWhatsapp} />
        </section>
      )}

      {/* The old bs42.net's gap between sections: each had 2em above and below, 3vw from sm up */}
      {cards.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:pt-[6vw] lg:px-6">
          <SectionTitle>Featured products</SectionTitle>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <li key={card.id}>
                <ProductCard card={card} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {bestSellers.length === BEST_SELLERS_COUNT && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:pt-[6vw] lg:px-6">
          <SectionTitle>Best sellers</SectionTitle>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {bestSellers.map((card, index) => (
              // Three on the middle widths' three columns, so the row stays even
              <li key={card.id} className={index === 3 ? "md:max-xl:hidden" : undefined}>
                <ProductCard card={card} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {posts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:pt-[6vw] lg:px-6">
          <SectionTitle>From the blog</SectionTitle>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.slice(0, BLOG_POSTS).map((post, index) => (
              // Two on the middle width's two columns, so the row stays even; a grid, so each card fills the row's height
              <div key={post.slug} className={index === 2 ? "grid sm:max-lg:hidden" : "grid"}>
                <BlogPostCard post={post} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              All posts
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:pt-[6vw] lg:px-6">
        <TradeBand />
      </section>
    </div>
  )
}

// A section's title centred between two rules, as the old bs42.net's homepage sections were
function SectionTitle({ children }: { children: string }) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <span className="h-px flex-1 bg-border" aria-hidden />
      <h2 className="text-[19px] font-bold text-foreground/80 lg:text-[22px]">{children}</h2>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  )
}
