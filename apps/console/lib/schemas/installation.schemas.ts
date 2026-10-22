import { GEODATA } from "@workspace/contracts"
import { z } from "zod"

// The Installation card in Settings: one row per region in GEODATA's order, covered whole or in the towns listed

const regionAreasSchema = z.object({
  region: z.string(),
  whole: z.boolean(),
  towns: z.array(z.object({ town: z.string().min(1, "Choose a town") })),
})

export const installationAreasFormSchema = z
  .object({
    regions: z.array(regionAreasSchema),
  })
  .superRefine((data, ctx) => {
    data.regions.forEach((region, regionIndex) => {
      // The action checks the names too: the client could send anything
      const known = GEODATA.find((item) => item.name === region.region)
      if (!known) return ctx.addIssue({ code: "custom", message: `${region.region} isn't a region`, path: ["regions", regionIndex, "region"] })
      // A whole region's towns aren't saved, so they aren't checked
      if (region.whole) return

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

export const saveInstallationAreasSchema = z.object({
  // The settings row's updatedAt as the page showed it, or "" before the first save (CONFLICT if it moved on)
  version: z.string(),
  settings: installationAreasFormSchema,
})
