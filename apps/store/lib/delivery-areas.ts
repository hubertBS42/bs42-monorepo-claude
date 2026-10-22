import "server-only"

import { loadDeliverySettings } from "@workspace/commerce/delivery"
import { findDeliveryRate } from "@workspace/commerce/delivery-rates"
import { GEODATA } from "@workspace/contracts"
import { prisma } from "@workspace/db"

// The towns there's a delivery fee for (a town's own, or its region's), by region, for checkout's and the quotation's
// address pickers, and whether a saved address can be delivered to
export async function getDeliveryAreas() {
  const { rates } = await loadDeliverySettings(prisma)
  const areas = GEODATA.map((region) => ({ region: region.name, towns: region.towns.filter((town) => findDeliveryRate(rates, region.name, town)) })).filter((area) => area.towns.length > 0)
  return { areas, deliversTo: (region: string, town: string) => !!findDeliveryRate(rates, region, town) }
}
