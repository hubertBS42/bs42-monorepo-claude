import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb"

import { ProductListing } from "@/components/catalogue/product-listing"
import type { SearchParams } from "@/lib/catalogue-filters"
import { getBrand } from "@/lib/data/brands"
import { loadProductCards } from "@/lib/data/product-cards"
import { priceCards } from "@/lib/pricing"
import { getShelfPricing } from "@/lib/settings"

interface BrandPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const brand = await getBrand((await params).slug)
  if (!brand) return {}
  return { title: brand.name, description: brand.description ?? undefined, alternates: { canonical: `/b/${brand.slug}` } }
}

export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const brand = await getBrand(slug)
  if (!brand) notFound()
  const [cards, pricing] = await Promise.all([loadProductCards({ brandId: brand.id }), getShelfPricing()])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{brand.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mt-4 mb-6 flex items-start gap-5">
        {brand.logo && (
          // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
          <img src={brand.logo} alt="" className="size-16 shrink-0 rounded-xl border bg-white object-contain p-2" />
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{brand.name}</h1>
          {brand.description && <p className="mt-2 max-w-2xl text-muted-foreground">{brand.description}</p>}
          {brand.website && (
            <a href={brand.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">
              {new URL(brand.website).hostname}
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </header>

      {cards.length ? (
        <ProductListing pathname={`/b/${brand.slug}`} params={query} cards={priceCards(cards, pricing)} />
      ) : (
        <p className="text-muted-foreground">Nothing from {brand.name} is on sale at the moment.</p>
      )}
    </div>
  )
}
