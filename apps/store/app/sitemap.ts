import type { MetadataRoute } from "next"

import { categoryHref, getCategoryTree } from "@/lib/data/categories"
import { loadProductCards } from "@/lib/data/product-cards"
import { getLegalPages } from "@/lib/settings"
import { siteUrl } from "@/lib/structured-data"

// Rebuilt as often as the data caches it reads expire (lib/data)
export const revalidate = 60

// Every page customers can reach: the homepage, each category with something on sale, each brand with something on
// sale, each product with an offer, and the Terms and Privacy pages once they're written. Search results are left out (they're noindex).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tree = await getCategoryTree()
  const cards = await loadProductCards({ categoryIds: [...tree.byId.keys()] })
  const brands = [...new Set(cards.map((card) => card.brand.slug))].sort()
  const legal = await getLegalPages()

  return [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/trade"), changeFrequency: "yearly", priority: 0.3 },
    ...[...tree.byId.values()].map((node) => ({ url: siteUrl(categoryHref(tree, node.id)), changeFrequency: "daily" as const, priority: 0.8 })),
    ...brands.map((slug) => ({ url: siteUrl(`/b/${slug}`), changeFrequency: "weekly" as const, priority: 0.5 })),
    ...cards.map((card) => ({ url: siteUrl(`/p/${card.slug}`), changeFrequency: "daily" as const, priority: 0.7, ...(card.image && { images: [card.image] }) })),
    ...(legal.terms ? [{ url: siteUrl("/terms"), lastModified: legal.terms.updatedAt, changeFrequency: "yearly" as const, priority: 0.1 }] : []),
    ...(legal.privacy ? [{ url: siteUrl("/privacy"), lastModified: legal.privacy.updatedAt, changeFrequency: "yearly" as const, priority: 0.1 }] : []),
  ]
}
