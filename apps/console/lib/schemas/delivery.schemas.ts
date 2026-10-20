import { GEODATA } from "@workspace/contracts"
import { z } from "zod"
import { decimalSchema, optionalDecimalSchema } from "./product.schemas"

// The Delivery card in Settings: one row per region in GEODATA's order, each with its own fee (empty: no delivery to
// the region, unless a town has a fee) and town fees that override it.

const townFeeSchema = z.object({
  town: z.string().min(1, "Choose a town"),
  feeGhs: decimalSchema,
})

const regionFeesSchema = z.object({
  region: z.string(),
  // A cleared field sends "", which means no delivery to the region's other towns
  feeGhs: optionalDecimalSchema,
  towns: z.array(townFeeSchema),
})

export const deliverySettingsFormSchema = z
  .object({
    // Empty: delivery is never free
    freeDeliveryFromGhs: optionalDecimalSchema,
    regions: z.array(regionFeesSchema),
  })
  .superRefine((data, ctx) => {
    data.regions.forEach((region, regionIndex) => {
      // The action checks the names too: the client could send anything
      const known = GEODATA.find((item) => item.name === region.region)
      if (!known) return ctx.addIssue({ code: "custom", message: `${region.region} isn't a region`, path: ["regions", regionIndex, "region"] })

      const seen = new Set<string>()
      region.towns.forEach((town, townIndex) => {
        const path = ["regions", regionIndex, "towns", townIndex, "town"]
        if (!town.town) return
        if (!known.towns.includes(town.town)) ctx.addIssue({ code: "custom", message: `${town.town} isn't in ${region.region}`, path })
        else if (seen.has(town.town)) ctx.addIssue({ code: "custom", message: `${town.town} is listed twice`, path })
        seen.add(town.town)
      })
    })
  })

export const saveDeliverySettingsSchema = z.object({
  // The settings row's updatedAt as the page showed it, or "" before the first save (CONFLICT if it moved on)
  version: z.string(),
  settings: deliverySettingsFormSchema,
})
