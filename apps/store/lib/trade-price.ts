// A trade account's shelf price, with no imports, for client components: the ex-tax price less the account's
// percentage, rounded to the cent as an order rounds a line of one (@workspace/commerce/pricing's tradePrice). The
// basket and checkout show the exact amounts.
export function tradeShelfPrice(exTaxGhs: string, percent: number) {
  const cents = Math.round(Number(exTaxGhs) * 100)
  // Half up, as Decimal's ROUND_HALF_UP; the small nudge keeps 12.5 × 199 / 100 from landing a hair under .5
  const discount = Math.round((cents * percent) / 100 + 1e-9)
  return ((cents - discount) / 100).toFixed(2)
}
