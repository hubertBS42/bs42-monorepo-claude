// Puts the setup in seed-config.json (written by export-config.ts) into a database, for going live: run it after
// `db:seed`, which makes the categories, brands and products it adds to.
//   pnpm --filter @workspace/db db:seed:config
// It only fills in what isn't set, so it never undoes a change made in the console: Settings, delivery fees,
// installation areas and the legal pages only when the database has none at all; a category's image or installation
// fee, or a brand's logo or description, only when it has none; featured only switched on; a product's installation
// only while it still uses its category's; a "pairs well with" list only for a category or product without one.
import { readFile } from "node:fs/promises"
import { prisma } from "../src/client"
import type { Prisma } from "../generated/prisma/client"
import type { SeedConfig } from "./seed-config-types"

const config: SeedConfig = JSON.parse(
  await readFile(new URL("./seed-config.json", import.meta.url), "utf8").catch(() => {
    throw new Error("No seed-config.json: run db:export-config against the database that's set up first")
  })
)

async function seedAppSettings() {
  if (!config.appSettings) return "not in the file"
  if (await prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { id: true } })) return "already set"
  await prisma.appSettings.create({ data: { id: "singleton", ...config.appSettings } })
  return "set"
}

async function seedDelivery() {
  if (!config.delivery.rates.length && !config.delivery.freeDeliveryFromGhs) return "not in the file"
  if ((await prisma.deliveryRate.count()) || (await prisma.deliverySettings.findUnique({ where: { id: "singleton" }, select: { id: true } }))) return "already set"
  await prisma.$transaction([
    prisma.deliverySettings.create({ data: { id: "singleton", freeDeliveryFromGhs: config.delivery.freeDeliveryFromGhs } }),
    prisma.deliveryRate.createMany({ data: config.delivery.rates }),
  ])
  return `${config.delivery.rates.length} fees set`
}

async function seedInstallationAreas() {
  if (!config.installationAreas.length) return "not in the file"
  if (await prisma.installationArea.count()) return "already set"
  await prisma.$transaction([
    prisma.installationSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} }),
    prisma.installationArea.createMany({ data: config.installationAreas }),
  ])
  return `${config.installationAreas.length} set`
}

async function seedLegalPages() {
  if (!config.legalPages) return "not in the file"
  if (await prisma.legalPages.findUnique({ where: { id: "singleton" }, select: { id: true } })) return "already set"
  const { termsPublished, privacyPublished, ...pages } = config.legalPages
  // A file from before publishing existed has no flags: its pages with text were live
  await prisma.legalPages.create({
    data: { id: "singleton", ...pages, termsPublished: termsPublished ?? !!pages.termsOfService, privacyPublished: privacyPublished ?? !!pages.privacyPolicy },
  })
  return "set"
}

async function findCategory(path: string[]) {
  let parentId: string | null = null
  let category: { id: string; image: string | null; isFeatured: boolean; installationFeeGhs: Prisma.Decimal | null } | null = null
  for (const name of path) {
    category = await prisma.category.findFirst({ where: { parentId, name }, select: { id: true, image: true, isFeatured: true, installationFeeGhs: true } })
    if (!category) return null
    parentId = category.id
  }
  return category
}

async function seedCategories() {
  const counts = { updated: 0, missing: [] as string[] }
  for (const seed of config.categories) {
    const category = await findCategory(seed.path)
    if (!category) {
      counts.missing.push(seed.path.join(" / "))
      continue
    }
    const data = {
      ...(!category.image && seed.image ? { image: seed.image } : {}),
      ...(category.installationFeeGhs === null && seed.installationFeeGhs ? { installationFeeGhs: seed.installationFeeGhs } : {}),
      ...(!category.isFeatured && seed.isFeatured ? { isFeatured: true } : {}),
    }
    if (!Object.keys(data).length) continue
    await prisma.category.update({ where: { id: category.id }, data })
    counts.updated++
  }
  return counts
}

async function seedBrands() {
  const counts = { updated: 0, missing: [] as string[] }
  for (const seed of config.brands) {
    const brand = await prisma.brand.findUnique({ where: { name: seed.name }, select: { id: true, logo: true, description: true, isFeatured: true } })
    if (!brand) {
      counts.missing.push(seed.name)
      continue
    }
    const data = {
      ...(!brand.logo && seed.logo ? { logo: seed.logo } : {}),
      ...(!brand.description && seed.description ? { description: seed.description } : {}),
      ...(!brand.isFeatured && seed.isFeatured ? { isFeatured: true } : {}),
    }
    if (!Object.keys(data).length) continue
    await prisma.brand.update({ where: { id: brand.id }, data })
    counts.updated++
  }
  return counts
}

async function seedProducts() {
  const counts = { updated: 0, missing: [] as string[] }
  for (const seed of config.products) {
    const products = await prisma.product.findMany({ where: { name: seed.name }, select: { id: true, installation: true, installationFeeGhs: true } })
    if (products.length !== 1) {
      counts.missing.push(seed.name)
      continue
    }
    const [product] = products
    if (product!.installation !== "CATEGORY" || product!.installationFeeGhs !== null) continue
    await prisma.product.update({ where: { id: product!.id }, data: { installation: seed.installation, installationFeeGhs: seed.installationFeeGhs } })
    counts.updated++
  }
  return counts
}

async function seedPairings() {
  const counts = { updated: 0, missing: [] as string[] }
  // A file exported before pairings existed has none
  for (const seed of config.pairings ?? []) {
    const owner = seed.category ? await findCategory(seed.category) : await prisma.product.findFirst({ where: { name: seed.product! }, select: { id: true } })
    const ownerName = seed.category ? seed.category.join(" / ") : seed.product!
    if (!owner) {
      counts.missing.push(ownerName)
      continue
    }
    const where = seed.category ? { categoryId: owner.id } : { productId: owner.id }
    if (await prisma.productPairing.count({ where })) continue
    const paired: string[] = []
    for (const name of seed.paired) {
      const products = await prisma.product.findMany({ where: { name }, select: { id: true } })
      if (products.length === 1 && products[0]!.id !== owner.id) paired.push(products[0]!.id)
      else counts.missing.push(`${name} (on ${ownerName}'s list)`)
    }
    if (!paired.length) continue
    await prisma.productPairing.createMany({ data: paired.map((pairedProductId, position) => ({ ...where, pairedProductId, position })) })
    counts.updated++
  }
  return counts
}

async function main() {
  console.log(`Settings: ${await seedAppSettings()}`)
  console.log(`Delivery fees: ${await seedDelivery()}`)
  console.log(`Installation areas: ${await seedInstallationAreas()}`)
  console.log(`Terms and Privacy: ${await seedLegalPages()}`)

  for (const [label, seed] of [
    ["Categories", seedCategories],
    ["Brands", seedBrands],
    ["Products' installation", seedProducts],
    ["Pairs well with lists", seedPairings],
  ] as const) {
    const { updated, missing } = await seed()
    console.log(`${label}: ${updated} updated`)
    if (missing.length) console.log(`  Not found (run db:seed first?): ${missing.join(", ")}`)
  }
}

try {
  await main()
} catch (error) {
  console.error("Seeding the setup failed:", error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
