// Writes what has been set up in the console to seed-config.json, for seed-config.ts to put in a new database (going
// live): Settings (general, pricing, notifications), delivery fees, installation areas, the Terms and Privacy pages, and
// what the console adds to the seeded catalogue: category images, featured flags and installation fees, brand logos and
// descriptions, and products' own installation choices. Not users, stores, listings, orders or exchange rates.
// Run against the database that has been set up (usually development):
//   pnpm --filter @workspace/db db:export-config
// Check the file before seeding with it: it's the production setup. It's gitignored, as it holds contact details and
// staff addresses and the repository is public. File URLs point at the storage container.
import { writeFile } from "node:fs/promises"
import { prisma } from "../src/client"
import type { AppSettings } from "../generated/prisma/client"
import type { SeedConfig } from "./seed-config-types"

// Everything but the row's id and timestamp
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- left out on purpose
function toAppSettingsSeed({ id: _id, updatedAt: _updatedAt, taxRate, exchangeRateMarkupPercent, ...settings }: AppSettings): NonNullable<SeedConfig["appSettings"]> {
  return { ...settings, taxRate: taxRate.toString(), exchangeRateMarkupPercent: exchangeRateMarkupPercent.toString() }
}

async function main() {
  const app = await prisma.appSettings.findUnique({ where: { id: "singleton" } })
  const delivery = await prisma.deliverySettings.findUnique({ where: { id: "singleton" } })
  const legal = await prisma.legalPages.findUnique({ where: { id: "singleton" } })

  const categories = await prisma.category.findMany({ select: { id: true, name: true, parentId: true, image: true, isFeatured: true, installationFeeGhs: true } })
  const byId = new Map(categories.map((category) => [category.id, category]))
  // A category is found by its path of names, since ids and slugs differ between databases
  const path = (id: string | null): string[] => {
    const category = id ? byId.get(id) : undefined
    return category ? [...path(category.parentId), category.name] : []
  }

  const products = await prisma.product.findMany({
    where: { OR: [{ installation: { not: "CATEGORY" } }, { installationFeeGhs: { not: null } }] },
    select: { name: true, installation: true, installationFeeGhs: true },
  })
  // Two products can share a name (seed.ts allows it): those can't be told apart in another database
  const nameCounts = new Map<string, number>()
  for (const { name } of await prisma.product.findMany({ select: { name: true } })) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)

  const config: SeedConfig = {
    appSettings: app && toAppSettingsSeed(app),
    delivery: {
      freeDeliveryFromGhs: delivery?.freeDeliveryFromGhs?.toString() ?? null,
      rates: (await prisma.deliveryRate.findMany({ orderBy: [{ region: "asc" }, { town: "asc" }] })).map(({ region, town, feeGhs }) => ({ region, town, feeGhs: feeGhs.toString() })),
    },
    installationAreas: (await prisma.installationArea.findMany({ orderBy: [{ region: "asc" }, { town: "asc" }] })).map(({ region, town }) => ({ region, town })),
    legalPages: legal
      ? {
          termsOfService: legal.termsOfService,
          termsUpdatedAt: legal.termsUpdatedAt?.toISOString() ?? null,
          privacyPolicy: legal.privacyPolicy,
          privacyUpdatedAt: legal.privacyUpdatedAt?.toISOString() ?? null,
        }
      : null,
    categories: categories
      .filter((category) => category.image || category.isFeatured || category.installationFeeGhs)
      .map((category) => ({ path: path(category.id), image: category.image, isFeatured: category.isFeatured, installationFeeGhs: category.installationFeeGhs?.toString() ?? null }))
      .sort((a, b) => a.path.join("/").localeCompare(b.path.join("/"))),
    brands: (await prisma.brand.findMany({ where: { OR: [{ logo: { not: null } }, { description: { not: null } }, { isFeatured: true }] }, orderBy: { name: "asc" } })).map(
      ({ name, logo, description, isFeatured }) => ({ name, logo, description, isFeatured })
    ),
    products: products
      .filter((product) => nameCounts.get(product.name) === 1)
      .map(({ name, installation, installationFeeGhs }) => ({ name, installation, installationFeeGhs: installationFeeGhs?.toString() ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }

  await writeFile(new URL("./seed-config.json", import.meta.url), `${JSON.stringify(config, null, 2)}\n`)
  const skipped = products.length - config.products.length
  console.log(
    `seed-config.json: settings ${app ? "saved" : "not set yet"}, ${config.delivery.rates.length} delivery fees, ${config.installationAreas.length} installation areas, legal pages ${legal ? "saved" : "not set yet"}, ${config.categories.length} categories, ${config.brands.length} brands, ${config.products.length} products`
  )
  if (skipped) console.log(`Left out ${skipped} products whose name another product shares: set their installation in the console`)
}

try {
  await main()
} catch (error) {
  console.error("Export failed:", error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
