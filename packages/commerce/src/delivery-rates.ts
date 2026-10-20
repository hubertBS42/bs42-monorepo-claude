// The delivery rate lookup, with no imports, so client components can use it to fill a fee in (with fees as strings).
// delivery.ts prices an order's delivery with it.

export interface DeliveryRateRow<Fee> {
  region: string
  // Null for the region's own fee
  town: string | null
  feeGhs: Fee
}

// The rate that applies to an address: its town's, else its region's, or undefined where there's no delivery
export function findDeliveryRate<R extends { region: string; town: string | null }>(rates: R[], region: string, town: string): R | undefined {
  return rates.find((rate) => rate.region === region && rate.town === town) ?? rates.find((rate) => rate.region === region && rate.town === null)
}
