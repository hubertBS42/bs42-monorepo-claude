import "server-only"

import type { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { InstallationOption } from "@workspace/db/enums"
import type { InstallationAreaRow } from "./installation-areas"

// Installation, which the platform's own installers do: each product's fee per unit (its category's, the nearest one
// up the tree with a fee, or its own, in GHS) and the areas they work in (Settings → Installation). The order line
// keeps the fee it was sold at. installation-areas.ts has the area lookup for client components.

type Client = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

interface CategoryFee {
  parentId: string | null
  installationFeeGhs: Prisma.Decimal | null
}

// The fee for installing one unit of a product, or null when it isn't offered
export function installationFee(
  product: { installation: InstallationOption; installationFeeGhs: Prisma.Decimal | null; categoryId: string },
  categories: Map<string, CategoryFee>
): Prisma.Decimal | null {
  if (product.installation === InstallationOption.NONE) return null
  if (product.installation === InstallationOption.OWN) return product.installationFeeGhs
  // The tree has no cycles (a trigger refuses them), but a bound costs nothing
  let category = categories.get(product.categoryId)
  for (let depth = 0; category && depth < 50; depth++) {
    if (category.installationFeeGhs) return category.installationFeeGhs
    category = category.parentId ? categories.get(category.parentId) : undefined
  }
  return null
}

// Every category's own fee and parent, for installationFee
export async function loadCategoryFees(client: Client) {
  const categories = await client.category.findMany({ select: { id: true, parentId: true, installationFeeGhs: true } })
  return new Map(categories.map(({ id, ...category }) => [id, category]))
}

// The fee per unit for each of the products that offer installation
export async function loadInstallationFees(client: Client, productIds: string[]) {
  const fees = new Map<string, Prisma.Decimal>()
  if (!productIds.length) return fees
  // One after the other: a transaction has one connection
  const products = await client.product.findMany({ where: { id: { in: productIds } }, select: { id: true, installation: true, installationFeeGhs: true, categoryId: true } })
  if (products.every((product) => product.installation === InstallationOption.NONE)) return fees
  const categories = await loadCategoryFees(client)
  for (const product of products) {
    const fee = installationFee(product, categories)
    if (fee) fees.set(product.id, fee)
  }
  return fees
}

export async function loadInstallationAreas(client: Client): Promise<InstallationAreaRow[]> {
  return client.installationArea.findMany({ select: { region: true, town: true }, orderBy: [{ region: "asc" }, { town: "asc" }] })
}
