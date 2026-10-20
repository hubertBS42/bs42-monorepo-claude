import "server-only"

import { unstable_cache } from "next/cache"
import { getPricingContext } from "@workspace/commerce/exchange-rates"
import { prisma, readAppSettings, resolveStoreName } from "@workspace/db"

// The storefront's own caches. Saving settings or a rate in the console refreshes the console's caches, which this app
// can't reach, so these only expire: a change shows here within a minute.
const REVALIDATE_SECONDS = 60

export const getAppSettings = unstable_cache(readAppSettings, ["store-app-settings"], { revalidate: REVALIDATE_SECONDS })

export async function getStoreName() {
  return resolveStoreName(await getAppSettings())
}

// What shown prices need: the GHS rate and the tax rate (null when tax is off), as strings so they can be cached. Null
// when there's no rate recent enough to sell at; the storefront then shows no prices, as an order would be refused.
export interface ShelfPricing {
  exchangeRate: string
  taxRate: string | null
}

export const getShelfPricing = unstable_cache(
  async (): Promise<ShelfPricing | null> => {
    const context = await getPricingContext()
    return context && { exchangeRate: context.rate.rate, taxRate: context.tax?.rate.toString() ?? null }
  },
  ["store-shelf-pricing"],
  { revalidate: REVALIDATE_SECONDS }
)

// The free-delivery threshold (GHS), for the product page's delivery note; null when every order pays the fee
export const getFreeDeliveryFrom = unstable_cache(
  async () => {
    const settings = await prisma.deliverySettings.findUnique({ where: { id: "singleton" }, select: { freeDeliveryFromGhs: true } })
    return settings?.freeDeliveryFromGhs?.toFixed(2) ?? null
  },
  ["store-free-delivery-from"],
  { revalidate: REVALIDATE_SECONDS }
)
