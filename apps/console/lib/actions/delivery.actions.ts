"use server"
import { z } from "zod"
import { prisma } from "@workspace/db"
import { formatError } from "@workspace/auth/format-error"
import type { ActionResponse } from "@workspace/contracts"
import { requireSystemPermission } from "@/lib/auth-guard"
import { saveDeliverySettingsSchema } from "@/lib/schemas/delivery.schemas"

// Every export here is a public endpoint, so every input is validated

const CONFLICT: ActionResponse = { success: false, error: "Someone else changed the delivery fees. Refresh the page to see them.", code: "CONFLICT" }

// Replaces every delivery rate with the card's, and the free-delivery threshold. Orders copy their fee, so past orders
// keep theirs.
export async function saveDeliverySettingsAction(input: z.input<typeof saveDeliverySettingsSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ appSettings: ["update"] })

  try {
    const parsed = saveDeliverySettingsSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
    const { version, settings } = parsed.data

    const regions = settings.regions.map((region) => region.region)
    if (new Set(regions).size !== regions.length) return { success: false, error: "A region is listed twice.", code: "INVALID" }

    const rates = settings.regions.flatMap((region) => [
      ...(region.feeGhs !== null && region.feeGhs !== undefined ? [{ region: region.region, town: null, feeGhs: region.feeGhs }] : []),
      ...region.towns.map((town) => ({ region: region.region, town: town.town, feeGhs: town.feeGhs })),
    ])
    const freeDeliveryFromGhs = settings.freeDeliveryFromGhs ?? null

    return await prisma.$transaction(
      async (tx) => {
        // Only from the version the page showed: the row's updatedAt, or no row at all before the first save
        if (version) {
          const { count } = await tx.deliverySettings.updateMany({ where: { id: "singleton", updatedAt: new Date(version) }, data: { freeDeliveryFromGhs } })
          if (count === 0) return CONFLICT
        } else {
          if (await tx.deliverySettings.findUnique({ where: { id: "singleton" }, select: { id: true } })) return CONFLICT
          await tx.deliverySettings.create({ data: { id: "singleton", freeDeliveryFromGhs } })
        }

        await tx.deliveryRate.deleteMany({})
        if (rates.length) await tx.deliveryRate.createMany({ data: rates })
        return { success: true } satisfies ActionResponse
      },
      { maxWait: 10_000, timeout: 30_000 }
    )
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
