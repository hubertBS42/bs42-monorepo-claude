// Lists the catalogue in a real store at the old site's prices, for going live: a listing for every published product
// with a sell price, and a row for each of its published variants (at its old product's prices where they differ).
// Stock starts at 0, so everything shows as out of stock until it's counted in: on each listing's form ("Count
// correction"), or by receiving a purchase order. Low-stock alerts start at 5, as the listing form's new rows do.
//
// Create the store in the console first (Stores → Add Store), so it has its members, then run, with its slug (the end of
// its URL on the Stores page):
//   pnpm --filter @workspace/db db:seed:listings --store <slug>
// Safe to run again: a product the store already lists is skipped, whatever its prices and stock now.
import { prisma } from "../src/client"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { listingVariantPrices } from "./product-seeds"

const LOW_STOCK_THRESHOLD = 5

function storeSlug() {
  const at = process.argv.indexOf("--store")
  const slug = at === -1 ? undefined : process.argv[at + 1]
  if (!slug || slug.startsWith("--")) throw new Error("Name the store: --store <slug>")
  return slug
}

async function main() {
  const slug = storeSlug()
  if (slug === PLATFORM_ORGANIZATION_SLUG) throw new Error("That's the platform, not a store")
  const store = await prisma.organization.findUnique({ where: { slug }, select: { id: true, name: true } })
  if (!store) throw new Error(`No store has the slug "${slug}"`)

  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", baseSellPrice: { gt: 0 } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      baseSellPrice: true,
      baseBuyPrice: true,
      hasVariants: true,
      variants: { where: { status: "PUBLISHED" }, orderBy: { position: "asc" }, select: { id: true, position: true } },
    },
  })
  const listed = new Set((await prisma.storeListing.findMany({ where: { organizationId: store.id }, select: { productId: true } })).map((row) => row.productId))

  const counts = { created: 0, skipped: 0, noVariants: 0 }
  for (const product of products) {
    if (listed.has(product.id)) {
      counts.skipped++
      continue
    }
    // Nothing of it could go on sale
    if (product.hasVariants && !product.variants.length) {
      counts.noVariants++
      continue
    }

    // No stock, so no "Initial stock" movement: stock history starts with the first count or delivery
    await prisma.storeListing.create({
      data: {
        organizationId: store.id,
        productId: product.id,
        sellPrice: product.baseSellPrice,
        buyPrice: product.baseBuyPrice,
        stock: 0,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
        status: "PUBLISHED",
        storeListingVariants: {
          create: product.variants.map((variant) => ({
            variantId: variant.id,
            ...listingVariantPrices(product, variant.position),
            stock: 0,
            lowStockThreshold: LOW_STOCK_THRESHOLD,
            status: "PUBLISHED",
          })),
        },
      },
    })
    counts.created++
  }

  console.log(`${store.name}: ${counts.created} listings created, ${counts.skipped} already listed`)
  if (counts.noVariants) console.log(`Left out ${counts.noVariants} products with variants but none published`)
}

try {
  await main()
} catch (error) {
  console.error("Seeding listings failed:", error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
