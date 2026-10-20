import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb"

import { ProductListing } from "@/components/catalogue/product-listing"
import { hrefWith, specFilters, type SearchParams } from "@/lib/catalogue-filters"
import { categoryHref, categoryPath, getCategoryTree, getFilterSpecs, subtreeIds } from "@/lib/data/categories"
import { loadProductCards } from "@/lib/data/product-cards"
import { priceCards } from "@/lib/pricing"
import { getShelfPricing } from "@/lib/settings"
import { breadcrumbJsonLd, JsonLd } from "@/lib/structured-data"

interface CategoryPageProps {
  // The category's path of slugs, top first. Its own slug finds it (slugs are unique); the rest is for people and
  // search engines, and is put right if the category has moved.
  params: Promise<{ slug: string[] }>
  searchParams: Promise<SearchParams>
}

async function findCategory(slug: string[]) {
  const tree = await getCategoryTree()
  const node = tree.bySlug.get(slug.at(-1) ?? "")
  return node ? { tree, node } : null
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const found = await findCategory((await params).slug)
  if (!found) return {}
  return { title: found.node.name, description: found.node.description ?? undefined, alternates: { canonical: categoryHref(found.tree, found.node.id) } }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const found = await findCategory(slug)
  if (!found) notFound()
  const { tree, node } = found

  const pathname = categoryHref(tree, node.id)
  if (`/c/${slug.join("/")}` !== pathname) permanentRedirect(hrefWith(pathname, query, { set: {} }))

  const path = categoryPath(tree, node.id)
  const [cards, specs, pricing] = await Promise.all([loadProductCards({ categoryIds: subtreeIds(node) }), getFilterSpecs(path.map((category) => category.id)), getShelfPricing()])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, ...path.map((category) => ({ name: category.name, path: categoryHref(tree, category.id) }))])} />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          {path.map((category) => (
            <BreadcrumbItem key={category.id}>
              <BreadcrumbSeparator />
              {category.id === node.id ? <BreadcrumbPage>{category.name}</BreadcrumbPage> : <BreadcrumbLink render={<Link href={categoryHref(tree, category.id)} />}>{category.name}</BreadcrumbLink>}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mt-4 mb-6">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{node.name}</h1>
        {node.description && <p className="mt-2 max-w-2xl text-muted-foreground">{node.description}</p>}
      </header>

      {node.children.length > 0 && (
        <nav aria-label="Subcategories" className="mb-8">
          <ul className="flex flex-wrap gap-2">
            {node.children.map((child) => (
              <li key={child.id}>
                <Link href={categoryHref(tree, child.id)} className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
                  {child.name}
                  <span className="text-xs text-muted-foreground tabular-nums">{child.productCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <ProductListing pathname={pathname} params={query} cards={priceCards(cards, pricing)} filters={specFilters(specs)} />
    </div>
  )
}
