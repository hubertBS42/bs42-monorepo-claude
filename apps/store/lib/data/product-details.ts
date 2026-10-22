import "server-only"

import { unstable_cache } from "next/cache"
import { installationFee, loadCategoryFees } from "@workspace/commerce/installation"
import { InstallationOption } from "@workspace/db/enums"
import { prisma } from "@workspace/db"

// What only the product page shows, beyond its card (lib/data/product-cards.ts, which decides whether customers can
// see it at all). Variants are keyed by id, for the variant the page has picked.
export const getProductDetails = unstable_cache(
  async (productId: string) => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: {
        description: true,
        images: true,
        sku: true,
        barcode: true,
        weight: true,
        dimensions: true,
        categoryId: true,
        installation: true,
        installationFeeGhs: true,
        documents: { orderBy: { name: "asc" }, select: { id: true, name: true, url: true } },
        variants: { select: { id: true, sku: true, barcode: true, images: true, weight: true, dimensions: true } },
      },
    })
    const facts = (row: { sku: string | null; barcode: string | null; weight: { toString(): string } | null; dimensions: string | null }) => ({
      sku: row.sku,
      barcode: row.barcode,
      weightKg: row.weight?.toString() ?? null,
      dimensions: row.dimensions,
    })
    const fee = product.installation === InstallationOption.NONE ? null : installationFee(product, await loadCategoryFees(prisma))
    return {
      description: product.description,
      // Installing one unit, in GHS before tax; null when it isn't offered
      installationFeeGhs: fee?.toFixed(2) ?? null,
      images: product.images,
      documents: product.documents,
      facts: facts(product),
      variants: Object.fromEntries(product.variants.map((variant) => [variant.id, { images: variant.images, ...facts(variant) }])),
    }
  },
  ["store-product-details"],
  { revalidate: 60 }
)

export type ProductDetails = Awaited<ReturnType<typeof getProductDetails>>

// The description's text, for the page's meta description
export function plainText(richText: string | null, maxLength = 160) {
  if (!richText) return null
  const parts: string[] = []
  const walk = (node: unknown) => {
    if (typeof node !== "object" || node === null) return
    const { text, content } = node as { text?: unknown; content?: unknown }
    if (typeof text === "string") parts.push(text)
    if (Array.isArray(content)) for (const child of content) walk(child)
  }
  try {
    walk(JSON.parse(richText))
  } catch {
    return null
  }
  const text = parts.join(" ").replace(/\s+/g, " ").trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text || null
}
