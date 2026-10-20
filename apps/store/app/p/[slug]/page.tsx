import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { RichTextContent } from "@workspace/forms/components/rich-text-content"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb"
import { getStringParam } from "@workspace/utils/search-params"

import { ProductView } from "@/components/product/product-view"
import type { SearchParams } from "@/lib/catalogue-filters"
import { categoryHref, categoryPath, getCategoryTree } from "@/lib/data/categories"
import { loadProductCards } from "@/lib/data/product-cards"
import { getProductDetails, plainText } from "@/lib/data/product-details"
import { priceCards } from "@/lib/pricing"
import { getFreeDeliveryFrom, getShelfPricing } from "@/lib/settings"

interface ProductPageProps {
  params: Promise<{ slug: string }>
  // ?variant= picks the variant shown first
  searchParams: Promise<SearchParams>
}

// The product's card decides whether customers can see it: no offer, no page
async function findProduct(slug: string) {
  const [card] = await loadProductCards({ slug })
  return card ?? null
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const card = await findProduct((await params).slug)
  if (!card) return {}
  const details = await getProductDetails(card.id)
  const image = details.images[0]
  return {
    title: card.name,
    description: plainText(details.description) ?? undefined,
    alternates: { canonical: `/p/${card.slug}` },
    openGraph: { title: card.name, images: image ? [image] : undefined },
  }
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const card = await findProduct(slug)
  if (!card) notFound()

  const [details, tree, pricing, freeDeliveryFrom] = await Promise.all([getProductDetails(card.id), getCategoryTree(), getShelfPricing(), getFreeDeliveryFrom()])
  const [priced] = priceCards([card], pricing)
  const path = categoryPath(tree, card.categoryId)
  const description = details.description ? <RichTextContent value={details.description} /> : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          {path.map((category) => (
            <BreadcrumbItem key={category.id}>
              <BreadcrumbSeparator />
              <BreadcrumbLink render={<Link href={categoryHref(tree, category.id)} />}>{category.name}</BreadcrumbLink>
            </BreadcrumbItem>
          ))}
          <BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbPage className="line-clamp-1">{card.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <ProductView card={priced!} details={details} initialVariantId={getStringParam(query.variant) ?? null} description={description} freeDeliveryFromGhs={freeDeliveryFrom} />
    </div>
  )
}
