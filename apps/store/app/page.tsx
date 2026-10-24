import { CategoryCarousel } from "@/components/home/category-carousel"
import { CategoryGrid } from "@/components/home/category-grid"
import { ProductCard } from "@/components/product-card"
import { SearchForm } from "@/components/search-form"
import { categoryHref, featuredCategories, getCategoryTree } from "@/lib/data/categories"
import { loadProductCards } from "@/lib/data/product-cards"
import { isInStock } from "@/lib/product-cards"
import { priceCards } from "@/lib/pricing"
import { getAppSettings, getShelfPricing, getStoreName } from "@/lib/settings"

const FEATURED_COUNT = 8

export default async function HomePage() {
  const [settings, storeName, tree, featured, pricing] = await Promise.all([getAppSettings(), getStoreName(), getCategoryTree(), loadProductCards({ featured: true }), getShelfPricing()])
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

  return (
    <>
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
        <h2 className="mb-5 text-2xl font-bold tracking-tight md:text-3xl">Shop by category</h2>
        <CategoryGrid tiles={tiles} />
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
