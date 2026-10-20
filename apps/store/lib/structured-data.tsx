import { authURLs } from "@workspace/auth/constants"
import type { Condition } from "@workspace/db/enums"

import type { PricedCard } from "@/lib/product-cards"

// schema.org data for search engines: a product's offers and the breadcrumb trail. Prices are what the page shows (GHS,
// with tax when it's on); without a rate to sell at there are none, so offers are left out.

export const siteUrl = (path: string) => new URL(path, authURLs.store).toString()

const CONDITIONS: Record<Condition, string> = {
  NEW: "https://schema.org/NewCondition",
  REFURBISHED: "https://schema.org/RefurbishedCondition",
  USED_LIKE_NEW: "https://schema.org/UsedCondition",
  USED_GOOD: "https://schema.org/UsedCondition",
  USED_FAIR: "https://schema.org/UsedCondition",
}

function availability(card: PricedCard) {
  if (card.offers.some((offer) => offer.stock.kind === "in-stock")) return "https://schema.org/InStock"
  if (card.offers.some((offer) => offer.stock.kind === "out" && offer.stock.onOrder)) return "https://schema.org/BackOrder"
  return "https://schema.org/OutOfStock"
}

export function productJsonLd(card: PricedCard, { description, images, sku }: { description: string | null; images: string[]; sku: string | null }) {
  const url = siteUrl(`/p/${card.slug}`)
  const prices = card.offers.flatMap((offer) => (offer.price ? [offer.price.ghs] : [])).sort((a, b) => Number(a) - Number(b))
  const common = { priceCurrency: "GHS", availability: availability(card), itemCondition: CONDITIONS[card.condition], url }
  const offers =
    prices.length === 0
      ? undefined
      : prices.length === 1
        ? { "@type": "Offer", price: prices[0], ...common }
        : { "@type": "AggregateOffer", lowPrice: prices[0], highPrice: prices.at(-1), offerCount: prices.length, ...common }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: card.name,
    url,
    ...(description && { description }),
    ...(images.length && { image: images }),
    ...(sku && { sku }),
    brand: { "@type": "Brand", name: card.brand.name },
    ...(offers && { offers }),
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: siteUrl(item.path) })),
  }
}

// As Next's JSON-LD guide recommends: names and descriptions come from staff, so "<" is escaped and the data can't
// close the script tag
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
}
