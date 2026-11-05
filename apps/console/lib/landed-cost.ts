import { Prisma } from "@workspace/db/client"
import { Currency } from "@workspace/db/enums"

// Landed cost: what a unit really costs once it's here. A purchase order's shipping and import costs (freight, duty,
// clearing: its shippingCost) are spread over its lines by value, so a line worth twice as much per unit carries twice
// the share per unit. Receiving with "Update buy prices" sets buy prices to it, so margins count what stock really cost.
// Plain (no server-only), so the receiving transaction and the page's loader work it out the same way.

export interface LandedCostLine {
  id: string
  quantityOrdered: number
  unitCostUsd: Prisma.Decimal
}

// An amount in the order's currency in USD, rounded once, half up, as its lines' costs are; null for an order in GHS
// with no rate yet (a draft)
export function orderAmountInUsd(amount: Prisma.Decimal, currency: Currency, rate: Prisma.Decimal | null) {
  if (currency === Currency.USD) return amount
  return rate ? amount.div(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) : null
}

// Each line's landed cost per unit in USD, by line id, rounded to the cent. `extraUsd` is the order's shipping and
// import costs in USD. Shares go by what was ordered, as the invoice charged.
export function landedUnitCostsUsd(lines: LandedCostLine[], extraUsd: Prisma.Decimal) {
  const zero = new Prisma.Decimal(0)
  const goods = lines.reduce((sum, line) => sum.plus(line.unitCostUsd.times(line.quantityOrdered)), zero)
  const units = lines.reduce((sum, line) => sum + line.quantityOrdered, 0)

  return new Map(
    lines.map((line) => {
      // By value; on an order whose goods cost nothing (free samples), by units
      const share = extraUsd.isZero() ? zero : goods.gt(0) ? extraUsd.times(line.unitCostUsd).div(goods) : units > 0 ? extraUsd.div(units) : zero
      return [line.id, line.unitCostUsd.plus(share).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)]
    })
  )
}
