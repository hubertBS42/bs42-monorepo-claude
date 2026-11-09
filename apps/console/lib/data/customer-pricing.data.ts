import "server-only"

import { getPricingContext } from "@workspace/commerce/exchange-rates"

import type { CustomerPricing } from "@/lib/customer-price"

// What customerPriceLabel needs: today's rate and tax, or null when the storefront isn't showing prices
export async function getCustomerPricing(): Promise<CustomerPricing | null> {
  const context = await getPricingContext()
  if (!context) return null
  return { rate: context.rate.rate, taxRate: context.tax?.rate.gt(0) ? context.tax.rate.toFixed(4) : null }
}
