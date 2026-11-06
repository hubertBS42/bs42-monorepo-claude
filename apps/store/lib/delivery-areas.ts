import "server-only"

import { loadDeliverySettings } from "@workspace/commerce/delivery"
import { findDeliveryRate } from "@workspace/commerce/delivery-rates"
import { GEODATA } from "@workspace/contracts"
import { prisma } from "@workspace/db"

// The towns there's a delivery fee for (a town's own, or its region's), by region, for checkout's and the quotation's
// address pickers, and whether a saved address can be delivered to. With no fees set at all (feesSet false),
// quotations offer every town instead, leaving delivery to be confirmed (priceCheckout's deliveryMayWait).
export async function getDeliveryAreas() {
  const { rates } = await loadDeliverySettings(prisma)
  const areas = GEODATA.map((region) => ({ region: region.name, towns: region.towns.filter((town) => findDeliveryRate(rates, region.name, town)) })).filter((area) => area.towns.length > 0)
  return { areas, feesSet: rates.length > 0, deliversTo: (region: string, town: string) => !!findDeliveryRate(rates, region, town) }
}

// Every town, for a quotation's address while no delivery fees are set
export const allAreas = () => GEODATA.map((region) => ({ region: region.name, towns: [...region.towns] }))
