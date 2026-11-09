import { formatCurrency } from "@workspace/utils/currency"

// The storefront's cedi price for a USD price, for staff, with no Prisma import so forms can work it out as they type.
// Whole numbers, so it matches shelfPrice in @workspace/commerce/pricing to the pesewa; orders still price with that.
export interface CustomerPricing {
  // USD→GHS, to 6 places
  rate: string
  // A fraction to 4 places; null when no tax is charged
  taxRate: string | null
}

// Half up, as toCents rounds
const divideRounded = (value: bigint, by: bigint) => (value + by / 2n) / by

function customerPriceGhs(usd: number, { rate, taxRate }: CustomerPricing) {
  const exTaxPesewas = divideRounded(BigInt(Math.round(usd * 100)) * BigInt(Math.round(Number(rate) * 1e6)), 1_000_000n)
  const taxPesewas = taxRate ? divideRounded(exTaxPesewas * BigInt(Math.round(Number(taxRate) * 1e4)), 10_000n) : 0n
  return Number(exTaxPesewas + taxPesewas) / 100
}

// "GH₵210.60", or null with no rate fresh enough to sell at or no price yet. Takes a form field's value as it stands.
export function customerPriceLabel(usd: unknown, pricing: CustomerPricing | null) {
  if (!pricing || usd === null || usd === undefined || usd === "") return null
  const amount = Number(usd)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return formatCurrency(customerPriceGhs(amount, pricing), "GHS", "en-GH")
}

// For under a price field: says what the figure is
export function customerPriceNote(usd: unknown, pricing: CustomerPricing | null) {
  const label = customerPriceLabel(usd, pricing)
  return label ? `${label} today${pricing?.taxRate ? ", with tax" : ""}` : undefined
}
