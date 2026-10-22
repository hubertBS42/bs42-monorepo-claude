"use server"
import { z } from "zod"
import { prisma } from "@workspace/db"
import { formatError } from "@workspace/auth/format-error"
import type { ActionResponse } from "@workspace/contracts"
import { requireSystemPermission } from "@/lib/auth-guard"
import { saveInstallationAreasSchema } from "@/lib/schemas/installation.schemas"

// Every export here is a public endpoint, so every input is validated

const CONFLICT: ActionResponse = { success: false, error: "Someone else changed where installation is offered. Refresh the page to see it.", code: "CONFLICT" }

// Replaces every installation area with the card's. Orders already placed keep their installation.
export async function saveInstallationAreasAction(input: z.input<typeof saveInstallationAreasSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ appSettings: ["update"] })

  try {
    const parsed = saveInstallationAreasSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
    const { version, settings } = parsed.data

    const regions = settings.regions.map((region) => region.region)
    if (new Set(regions).size !== regions.length) return { success: false, error: "A region is listed twice.", code: "INVALID" }

    const areas = settings.regions.flatMap((region): { region: string; town: string | null }[] =>
      region.whole ? [{ region: region.region, town: null }] : region.towns.map(({ town }) => ({ region: region.region, town }))
    )

    return await prisma.$transaction(
      async (tx) => {
        // Only from the version the page showed: the row's updatedAt, or no row at all before the first save
        if (version) {
          const { count } = await tx.installationSettings.updateMany({ where: { id: "singleton", updatedAt: new Date(version) }, data: { updatedAt: new Date() } })
          if (count === 0) return CONFLICT
        } else {
          if (await tx.installationSettings.findUnique({ where: { id: "singleton" }, select: { id: true } })) return CONFLICT
          await tx.installationSettings.create({ data: { id: "singleton" } })
        }

        await tx.installationArea.deleteMany({})
        if (areas.length) await tx.installationArea.createMany({ data: areas })
        return { success: true } satisfies ActionResponse
      },
      { maxWait: 10_000, timeout: 30_000 }
    )
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
