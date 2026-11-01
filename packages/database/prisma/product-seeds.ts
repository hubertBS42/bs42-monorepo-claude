// The old site's products (seed-products.json), for the catalogue seed (seed.ts) and the store listings seeded from
// their prices (the demo store's, and a real store's with seed-listings.ts).
import { readFile } from "node:fs/promises"
import { Prisma } from "../generated/prisma/client"

// A product in seed-products.json. Prices are USD, as strings so they reach the Decimal columns exactly. `category` is a
// leaf category's name, `description` the editor's JSON, and the files are URLs in the storage container. `from` names
// the old product(s) it was made from. Each of `variants` has a value for every option, and its old product's prices:
// catalogue variants have no price of their own, so only seeded store listings use them.
export type ProductSeed = {
  from: string[]
  name: string
  brand: string
  category: string
  condition: "NEW" | "USED_GOOD"
  sell: string
  buy: string
  status: "PUBLISHED" | "DRAFT"
  description: string | null
  tags: string[]
  images: string[]
  documents: { name: string; url: string }[]
  options?: { name: string; values: string[] }[]
  variants?: { values: Record<string, string>; sell: string; buy: string; images: string[] }[]
}

export const productSeeds: ProductSeed[] = JSON.parse(await readFile(new URL("./seed-products.json", import.meta.url), "utf8"))

// Each variant's old prices, by product name and then the variant's position (seedProducts creates them in file order)
const variantSeeds = new Map(productSeeds.flatMap((seed) => (seed.variants ? [[seed.name, seed.variants] as const] : [])))

// A listing variant's own prices: the old product's, where they differ from the product's (null sells at the listing's)
export function listingVariantPrices(product: { name: string; baseSellPrice: Prisma.Decimal; baseBuyPrice: Prisma.Decimal }, position: number) {
  const prices = variantSeeds.get(product.name)?.[position]
  return {
    sellPrice: prices && !product.baseSellPrice.equals(prices.sell) ? new Prisma.Decimal(prices.sell) : null,
    buyPrice: prices && !product.baseBuyPrice.equals(prices.buy) ? new Prisma.Decimal(prices.buy) : null,
  }
}
