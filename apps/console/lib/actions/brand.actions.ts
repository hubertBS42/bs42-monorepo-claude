"use server"
import { z } from "zod"
import { addBrandFormSchema, updateBrandFormSchema } from "@/lib/schemas/brand.schemas"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { formatError } from "@workspace/auth/format-error"
import { ActionResponse } from "@workspace/contracts"
import { isManagedFileUrl, removeFiles } from "@workspace/storage"
import { requireSystemPermission } from "@/lib/auth-guard"

// Every export here is a public endpoint, so every input is validated

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const brandIdSchema = z.uuid("Invalid brand ID")

const NAME_EXISTS: ActionResponse = { success: false, error: "A brand with this name already exists.", code: "NAME_EXISTS" }
const INVALID_LOGO: ActionResponse = { success: false, error: "Invalid logo URL.", code: "INVALID_FILE" }
const HAS_PRODUCTS: ActionResponse = { success: false, error: "This brand has products. Move them to another brand or archive it instead.", code: "HAS_PRODUCTS" }

// The name column is unique but case-sensitive, so "Nike" and "nike" are caught here instead
async function isNameTaken(name: string, excludeId?: string) {
  const existing = await prisma.brand.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(excludeId && { id: { not: excludeId } }) },
    select: { id: true },
  })
  return !!existing
}

// Slug collisions are retried by the Prisma hook, so a unique violation that reaches here is the name
function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export async function createBrandAction(input: z.input<typeof addBrandFormSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ brand: ["create"] })

  try {
    const parsed = addBrandFormSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)

    // The client could send any URL, so only accept blobs in our own container
    if (parsed.data.logo !== null && !isManagedFileUrl(parsed.data.logo)) return INVALID_LOGO
    if (await isNameTaken(parsed.data.name)) return NAME_EXISTS

    await prisma.brand.create({
      // Placeholder: the Prisma hook generates the real slug from the name
      data: { ...parsed.data, slug: "" },
    })
    return { success: true }
  } catch (error) {
    if (isUniqueConstraintError(error)) return NAME_EXISTS
    return { success: false, error: formatError(error) }
  }
}

export async function updateBrandAction(input: z.input<typeof updateBrandFormSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ brand: ["update"] })

  try {
    const parsed = updateBrandFormSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)

    const { id, ...data } = parsed.data

    if (data.logo !== null && !isManagedFileUrl(data.logo)) return INVALID_LOGO

    const previous = await prisma.brand.findUnique({ where: { id }, select: { logo: true } })
    if (!previous) return { success: false, error: "Brand not found.", code: "NOT_FOUND" }

    if (await isNameTaken(data.name, id)) return NAME_EXISTS

    await prisma.brand.update({
      where: { id },
      data,
    })

    // Only the server knows the previous logo, so it removes a replaced one once the update has been saved
    if (previous.logo !== data.logo) await removeFiles([previous.logo])

    return { success: true }
  } catch (error) {
    if (isUniqueConstraintError(error)) return NAME_EXISTS
    return { success: false, error: formatError(error) }
  }
}

export async function deleteBrandAction(brandId: string): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ brand: ["delete"] })

  try {
    const parsed = brandIdSchema.safeParse(brandId)
    if (!parsed.success) return invalidInput(parsed.error)

    // The foreign key would reject this anyway, but with an error the form can't explain
    if ((await prisma.product.count({ where: { brandId: parsed.data } })) > 0) return HAS_PRODUCTS

    // The Prisma hook removes the logo after the delete commits
    await prisma.brand.delete({
      where: { id: parsed.data },
    })
    return { success: true }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return { success: false, error: "Brand not found.", code: "NOT_FOUND" }
      // A product was added between the check and the delete
      if (error.code === "P2003") return HAS_PRODUCTS
    }
    return { success: false, error: formatError(error) }
  }
}
