import "server-only"

import { loadDeliverySettings } from "@workspace/commerce/delivery"
import type { DeliveryRateRow } from "@workspace/commerce/delivery-rates"
import { prisma } from "@workspace/db"

// Delivery fees as plain values for client components (Decimal can't be passed to them), for the Delivery card and
// the create-order wizard. Not secret: the storefront shows them to anyone.
export interface DeliverySettingsView {
  // The settings row's updatedAt, or "" before the first save: the Delivery card sends it back
  version: string
  freeDeliveryFromGhs: string | null
  rates: DeliveryRateRow<string>[]
}

export async function getDeliverySettings(): Promise<DeliverySettingsView> {
  const settings = await loadDeliverySettings(prisma)
  return {
    version: settings.updatedAt?.toISOString() ?? "",
    freeDeliveryFromGhs: settings.freeDeliveryFromGhs?.toFixed(2) ?? null,
    rates: settings.rates.map((rate) => ({ ...rate, feeGhs: rate.feeGhs.toFixed(2) })),
  }
}
