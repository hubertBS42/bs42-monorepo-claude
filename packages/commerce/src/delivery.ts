import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { findDeliveryRate, type DeliveryRateRow } from "./delivery-rates"

// Delivery fees, in GHS, from the rates in Settings → Delivery: a town's fee, else its region's; an address with
// neither isn't delivered to. Orders whose subtotal after their discount reaches the free-delivery threshold deliver
// free. Client components look a rate up with delivery-rates.ts instead.

type Client = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface DeliverySettingsData {
  rates: DeliveryRateRow<Prisma.Decimal>[]
  freeDeliveryFromGhs: Prisma.Decimal | null
}

export interface DeliveryQuote {
  // What the order is charged: the area's fee, or 0 when it qualifies for free delivery
  feeGhs: Prisma.Decimal
  areaFeeGhs: Prisma.Decimal
  isFree: boolean
}

// The fee for delivering an order to an address, or null where there's no delivery. subtotalAfterDiscountGhs is the
// order's subtotal less its discount (from priceOrder), so a discount can't take an order under the threshold and
// still deliver free.
export function quoteDelivery(settings: DeliverySettingsData, region: string, town: string, subtotalAfterDiscountGhs: Prisma.Decimal): DeliveryQuote | null {
  const rate = findDeliveryRate(settings.rates, region, town)
  if (!rate) return null
  const isFree = settings.freeDeliveryFromGhs !== null && subtotalAfterDiscountGhs.gte(settings.freeDeliveryFromGhs)
  return { feeGhs: isFree ? new Prisma.Decimal(0) : rate.feeGhs, areaFeeGhs: rate.feeGhs, isFree }
}

export async function loadDeliverySettings(client: Client): Promise<DeliverySettingsData & { updatedAt: Date | null }> {
  // One after the other: a transaction has one connection
  const settings = await client.deliverySettings.findUnique({ where: { id: "singleton" }, select: { freeDeliveryFromGhs: true, updatedAt: true } })
  const rates = await client.deliveryRate.findMany({ select: { region: true, town: true, feeGhs: true }, orderBy: [{ region: "asc" }, { town: "asc" }] })
  return { rates, freeDeliveryFromGhs: settings?.freeDeliveryFromGhs ?? null, updatedAt: settings?.updatedAt ?? null }
}
