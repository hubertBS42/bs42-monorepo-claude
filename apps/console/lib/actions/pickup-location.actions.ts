"use server"

import { revalidatePath } from "next/cache"
import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { hasStorePermission, requireConsoleAccess } from "@/lib/auth-guard"
import { otherBranchIds } from "@/lib/branch-prices"
import { removePickupLocationSchema, savePickupLocationSchema } from "@/lib/schemas/pickup-location.schemas"

// A store's pickup location, on its Store Details page: owners and admins (organization: update), as for the store's
// other details. Orders already made keep the location they copied.

const FORBIDDEN = { success: false as const, error: "Your role in this store can't change its pickup location.", code: "FORBIDDEN" }
const CONFLICT = { success: false as const, error: "Someone changed the pickup location since you opened the page. Refresh to see it.", code: "CONFLICT" }

export async function savePickupLocationAction(input: z.input<typeof savePickupLocationSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = savePickupLocationSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
    const { storeId, updatedAt, ...fields } = parsed.data
    if (!(await hasStorePermission(session.user.id, storeId, { organization: ["update"] }))) return FORBIDDEN

    const data = { name: fields.name, address: fields.address, hours: fields.hours || null, phone: fields.phone || null, mapUrl: fields.mapUrl || null }
    if (updatedAt) {
      // Only the version the card showed, so a save can't undo someone else's
      const { count } = await prisma.pickupLocation.updateMany({ where: { organizationId: storeId, updatedAt: new Date(updatedAt) }, data })
      if (count === 0) return CONFLICT
    } else {
      const existing = await prisma.pickupLocation.findUnique({ where: { organizationId: storeId }, select: { id: true } })
      if (existing) return CONFLICT
      await prisma.pickupLocation.create({ data: { ...data, organizationId: storeId } })
    }
    revalidatePath("/store")
    revalidatePath(`/stores/${storeId}/edit`)
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function removePickupLocationAction(input: z.input<typeof removePickupLocationSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = removePickupLocationSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid store ID", code: "INVALID" }
    if (!(await hasStorePermission(session.user.id, parsed.data.storeId, { organization: ["update"] }))) return FORBIDDEN

    await prisma.pickupLocation.deleteMany({ where: { organizationId: parsed.data.storeId } })
    revalidatePath("/store")
    revalidatePath(`/stores/${parsed.data.storeId}/edit`)
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

const setPickupSuppliersSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
  // A branch with no lead time doesn't supply the location
  suppliers: z.array(z.object({ storeId: z.uuid(), leadDays: z.number().int("Whole days").min(1, "At least 1 day").max(60, "At most 60 days") })).max(50),
})

// Which branches can supply the store's pickup location, and in how many days: replaced together. Only branches in the
// store's group: the business's own stock moves between them.
export async function setPickupSuppliersAction(input: z.input<typeof setPickupSuppliersSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = setPickupSuppliersSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
    const { storeId, suppliers } = parsed.data
    if (!(await hasStorePermission(session.user.id, storeId, { organization: ["update"] }))) return FORBIDDEN

    const [location, branches] = await Promise.all([prisma.pickupLocation.findUnique({ where: { organizationId: storeId }, select: { id: true } }), otherBranchIds(prisma, storeId)])
    if (!location) return { success: false, error: "Add the pickup location first.", code: "NO_LOCATION" }
    if (suppliers.some((supplier) => !branches.includes(supplier.storeId))) {
      return { success: false, error: "Only other branches in this store's group can supply it.", code: "NOT_A_BRANCH" }
    }
    await prisma.$transaction([
      prisma.pickupSupplier.deleteMany({ where: { pickupLocationId: location.id } }),
      prisma.pickupSupplier.createMany({ data: suppliers.map((supplier) => ({ pickupLocationId: location.id, organizationId: supplier.storeId, leadDays: supplier.leadDays })) }),
    ])
    revalidatePath("/store")
    revalidatePath(`/stores/${storeId}/edit`)
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
