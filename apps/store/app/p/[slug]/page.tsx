import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Fragment } from "react"
import { describeInstallationAreas } from "@workspace/commerce/installation-areas"
import { withTax } from "@workspace/commerce/pricing"
import { Prisma } from "@workspace/db/client"
import { RichTextContent } from "@workspace/forms/components/rich-text-content"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb"
import { formatPhoneNumber } from "@workspace/utils/phone"
import { getEnumParam, getPositiveIntegerParam, getStringParam } from "@workspace/utils/search-params"

import { ProductShelf } from "@/components/product/product-shelf"
import { ProductView } from "@/components/product/product-view"
import { ProductReviews } from "@/components/reviews/product-reviews"
import type { SearchParams } from "@/lib/catalogue-filters"
import { categoryHref, categoryPath, getCategoryTree, subtreeIds, type CategoryNode } from "@/lib/data/categories"
import { getPairedProductIds } from "@/lib/data/pairings"
import { loadProductCards } from "@/lib/data/product-cards"
import { getProductDetails, plainText, summaryLines } from "@/lib/data/product-details"
import { getProductReviews, getReviewSummary, REVIEW_SORTS, type ReviewSort } from "@/lib/data/reviews"
import type { ProductCardData } from "@/lib/product-cards"
import { priceCards } from "@/lib/pricing"
import { similarProducts } from "@/lib/similar-products"
import { getAppSettings, getFreeDeliveryFrom, getInstallationAreas, getShelfPricing } from "@/lib/settings"
import { breadcrumbJsonLd, JsonLd, productJsonLd } from "@/lib/structured-data"

interface ProductPageProps {
  params: Promise<{ slug: string }>
  // ?variant= picks the variant shown first; ?reviews= sorts the reviews and ?reviews-page= pages them
  searchParams: Promise<SearchParams>
}

// The product's card decides whether customers can see it: no offer, no page
async function findProduct(slug: string) {
  const [card] = await loadProductCards({ slug })
  return card ?? null
}

// The page with the reviews sorted or paged, keeping the variant, and back at the reviews
function reviewsHref(slug: string, query: SearchParams, sort: ReviewSort, change: { sort?: ReviewSort; page?: number }) {
  const params = new URLSearchParams()
  const variant = getStringParam(query.variant)
  if (variant) params.set("variant", variant)
  const nextSort = change.sort ?? sort
  if (nextSort !== "newest") params.set("reviews", nextSort)
  const page = change.page ?? getPositiveIntegerParam(query["reviews-page"], 1)
  if (page > 1) params.set("reviews-page", String(page))
  const search = params.toString()
  return `/p/${slug}${search ? `?${search}` : ""}#reviews`
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

// How many products "You may also like" shows: one row on wide screens, two on phones
const SIMILAR_COUNT = 4

// What the product pairs well with (on sale, in the list's order), and products like it: its own category's first, then
// the category above's when that's too few
async function loadShelves(card: ProductCardData, path: CategoryNode[]) {
  const pairedIds = await getPairedProductIds(card.id, path.map((node) => node.id).reverse())
  const [pairedCards, sameCategory] = await Promise.all([pairedIds.length ? loadProductCards({ productIds: pairedIds }) : [], loadProductCards({ categoryIds: [card.categoryId] })])
  const exclude = new Set(pairedIds)
  const parent = path.at(-2)
  const wider = sameCategory.filter((other) => other.id !== card.id && !exclude.has(other.id)).length < SIMILAR_COUNT && parent ? await loadProductCards({ categoryIds: subtreeIds(parent) }) : []
  const byId = new Map(pairedCards.map((paired) => [paired.id, paired]))
  return {
    pairs: pairedIds.flatMap((id) => byId.get(id) ?? []),
    similar: similarProducts(card, sameCategory, wider, exclude, SIMILAR_COUNT),
  }
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const card = await findProduct(slug)
  if (!card) notFound()

  const reviewSort = getEnumParam(query.reviews, REVIEW_SORTS) ?? "newest"
  const [details, tree, pricing, freeDeliveryFrom, installationAreas, reviewSummary, reviews, settings] = await Promise.all([
    getProductDetails(card.id),
    getCategoryTree(),
    getShelfPricing(),
    getFreeDeliveryFrom(),
    getInstallationAreas(),
    getReviewSummary(card.id),
    getProductReviews(card.id, reviewSort, getPositiveIntegerParam(query["reviews-page"], 1)),
    getAppSettings(),
  ])
  const [priced] = priceCards([card], pricing)
  const path = categoryPath(tree, card.categoryId)
  const shelves = await loadShelves(card, path)
  const description = details.description ? <RichTextContent value={details.description} /> : null
  // Offered once installers work somewhere, and priced as the shelf is (with tax when it's on)
  const installationAreasText = describeInstallationAreas(installationAreas)
  const installation =
    details.installationFeeGhs && installationAreasText && pricing
      ? { unitGhs: withTax(new Prisma.Decimal(details.installationFeeGhs), pricing.taxRate ? new Prisma.Decimal(pricing.taxRate) : null).toFixed(2), areas: installationAreasText }
      : null
  const firstVariant = priced!.offers[0]!.variantId
  const jsonLd = [
    productJsonLd(priced!, {
      description: plainText(details.description, 5000),
      images: details.images,
      sku: (firstVariant ? details.variants[firstVariant]?.sku : null) ?? details.facts.sku,
      rating: reviewSummary.count ? { average: reviewSummary.average, count: reviewSummary.count } : null,
      // The first page's newest: what the page shows unless sorted otherwise
      reviews: reviewSort === "newest" && reviews.page === 1 ? reviews.reviews.slice(0, 5) : [],
    }),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, ...path.map((category) => ({ name: category.name, path: categoryHref(tree, category.id) })), { name: card.name, path: `/p/${card.slug}` }]),
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 lg:px-6">
      <JsonLd data={jsonLd} />
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          {path.map((category) => (
            <Fragment key={category.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={categoryHref(tree, category.id)} />}>{category.name}</BreadcrumbLink>
              </BreadcrumbItem>
            </Fragment>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="line-clamp-1">{card.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <ProductView
        card={priced!}
        details={details}
        initialVariantId={getStringParam(query.variant) ?? null}
        description={description}
        freeDeliveryFromGhs={freeDeliveryFrom}
        installation={installation}
        summary={summaryLines(details.description)}
        contact={{ phone: settings.contactPhone, phoneLabel: settings.contactPhone && formatPhoneNumber(settings.contactPhone), whatsapp: settings.contactWhatsapp }}
      />

      <ProductShelf id="pairs-well-with" title="Pairs well with" cards={priceCards(shelves.pairs, pricing)} />

      <ProductReviews
        productSlug={card.slug}
        summary={reviewSummary}
        reviews={reviews.reviews}
        sort={reviewSort}
        page={reviews.page}
        pageCount={reviews.pageCount}
        href={(change) => reviewsHref(card.slug, query, reviewSort, change)}
      />

      <ProductShelf id="you-may-also-like" title="You may also like" cards={priceCards(shelves.similar, pricing)} />
    </div>
  )
}
