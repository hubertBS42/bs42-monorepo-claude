import { Prisma } from "@workspace/db/client"

// Order maths, as CLAUDE.md "Orders and money" describes it. Pure, with no database access, so it can be tested on
// its own and used in client components; resolveOrderLines (order-writes.ts) feeds it the stores' prices. Every amount
// is a Decimal: never JS numbers.

type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal

const ZERO = new Decimal(0)

// GHS amounts are rounded once, to the cent, half up
const toCents = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

export interface PricingLine {
  unitPriceUsd: Decimal
  quantity: number
}

export interface PricingInput {
  lines: PricingLine[]
  // GHS per 1 USD
  exchangeRate: Decimal
  shippingGhs: Decimal
  // FIXED: a GHS amount, capped at the subtotal. PERCENTAGE: 0-100.
  discount: { type: "FIXED" | "PERCENTAGE"; value: Decimal } | null
  // Null when tax is off: the order then copies a rate of 0
  tax: { rate: Decimal; onShipping: boolean } | null
}

export interface PricedLine {
  unitPriceUsd: Decimal
  totalPriceUsd: Decimal
  unitPriceGhs: Decimal
  totalPriceGhs: Decimal
  discountGhs: Decimal
  taxGhs: Decimal
}

export interface PricedOrder {
  lines: PricedLine[]
  subtotalUsd: Decimal
  subtotalGhs: Decimal
  // Null without a discount
  discountAmountGhs: Decimal | null
  shippingGhs: Decimal
  taxRate: Decimal
  taxGhs: Decimal
  totalGhs: Decimal
}

const sum = (values: Decimal[]) => values.reduce((total, value) => total.plus(value), ZERO)

// Each line's share of the discount, in proportion to its total. Shares are rounded down to the cent and the
// remainder goes on the last line, so they add up to the discount exactly and none is negative.
function splitDiscount(amount: Decimal, totals: Decimal[], subtotal: Decimal) {
  if (amount.isZero() || subtotal.isZero()) return totals.map(() => ZERO)
  const shares = totals.slice(0, -1).map((total) => amount.times(total).dividedBy(subtotal).toDecimalPlaces(2, Decimal.ROUND_DOWN))
  return [...shares, amount.minus(sum(shares))]
}

export function priceOrder({ lines, exchangeRate, shippingGhs, discount, tax }: PricingInput): PricedOrder {
  if (lines.length === 0) throw new Error("An order needs at least one line")

  const priced = lines.map(({ unitPriceUsd, quantity }) => {
    const unitPriceGhs = toCents(unitPriceUsd.times(exchangeRate))
    // From the rounded unit price, so quantity × unit price is the line total on a receipt
    return { unitPriceUsd, totalPriceUsd: unitPriceUsd.times(quantity), unitPriceGhs, totalPriceGhs: unitPriceGhs.times(quantity) }
  })

  const subtotalUsd = sum(priced.map((line) => line.totalPriceUsd))
  const subtotalGhs = sum(priced.map((line) => line.totalPriceGhs))

  const discountAmount = !discount ? ZERO : discount.type === "FIXED" ? Decimal.min(discount.value, subtotalGhs) : toCents(subtotalGhs.times(discount.value).dividedBy(100))
  const shares = splitDiscount(
    discountAmount,
    priced.map((line) => line.totalPriceGhs),
    subtotalGhs
  )

  const taxRate = tax?.rate ?? ZERO
  const pricedLines = priced.map((line, index) => {
    const discountGhs = shares[index]!
    // Tax is charged after the discount
    return { ...line, discountGhs, taxGhs: toCents(line.totalPriceGhs.minus(discountGhs).times(taxRate)) }
  })
  const shippingTax = tax?.onShipping ? toCents(shippingGhs.times(taxRate)) : ZERO
  const taxGhs = sum(pricedLines.map((line) => line.taxGhs)).plus(shippingTax)

  return {
    lines: pricedLines,
    subtotalUsd,
    subtotalGhs,
    discountAmountGhs: discount ? discountAmount : null,
    shippingGhs,
    taxRate,
    taxGhs,
    totalGhs: subtotalGhs.minus(discountAmount).plus(shippingGhs).plus(taxGhs),
  }
}

// What returning some of a line's units is worth: their share of what the customer paid for the line, after its share
// of the discount and with its tax (lineAmountGhs). Worked out on the running total, so a line returned in parts adds
// up to exactly the whole line. Shipping isn't part of it.
export function returnedUnitsAmount(lineAmountGhs: Decimal, quantity: number, returnedBefore: number, returning: number) {
  const upTo = (units: number) => toCents(lineAmountGhs.times(units).dividedBy(quantity))
  return upTo(returnedBefore + returning).minus(upTo(returnedBefore))
}
