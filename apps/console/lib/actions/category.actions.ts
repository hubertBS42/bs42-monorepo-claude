"use server"
import { z } from "zod"
import { addCategoryFormSchema, updateCategoryFormSchema } from "@/lib/schemas/category.schemas"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { Status } from "@workspace/db/enums"
import { formatError } from "@workspace/auth/format-error"
import { ActionResponse } from "@workspace/contracts"
import { isManagedFileUrl, removeFiles } from "@workspace/storage"
import { requireSystemPermission } from "@/lib/auth-guard"

// Every export here is a public endpoint, so every input is validated

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const categoryIdSchema = z.uuid("Invalid category ID")

const NOT_FOUND: ActionResponse = { success: false, error: "Category not found.", code: "NOT_FOUND" }
const HAS_CHILDREN: ActionResponse = { success: false, error: "This category has subcategories. Move or delete them first.", code: "HAS_CHILDREN" }
const NAME_EXISTS: ActionResponse = { success: false, error: "A category with this name already exists under this parent.", code: "NAME_EXISTS" }
const PARENT_NOT_FOUND: ActionResponse = { success: false, error: "The parent category no longer exists.", code: "PARENT_NOT_FOUND" }
const PARENT_ARCHIVED: ActionResponse = { success: false, error: "An archived category can't be a parent.", code: "PARENT_ARCHIVED" }
const INVALID_IMAGE: ActionResponse = { success: false, error: "Invalid image URL.", code: "INVALID_FILE" }
const PARENT_CYCLE: ActionResponse = { success: false, error: "A category can't be moved under itself or one of its subcategories.", code: "PARENT_CYCLE" }

// Names are unique among siblings but case-sensitive in the database, so "Shoes" and "shoes" are caught here instead
async function isNameTaken(name: string, parentId: string | null, excludeId?: string) {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, parentId, ...(excludeId && { id: { not: excludeId } }) },
    select: { id: true },
  })
  return !!existing
}

// Slug collisions are retried by the Prisma hook, so a unique violation that reaches here is the name
function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

// On create or update: the parent was deleted between the check and the write.
// On delete: a subcategory was added between the check and the delete.
function isForeignKeyError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003"
}

export async function createCategoryAction(input: z.input<typeof addCategoryFormSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ category: ["create"] })

  try {
    const parsed = addCategoryFormSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)

    const { parentId, image } = parsed.data

    // The client could send any URL, so only accept blobs in our own container
    if (image !== null && !isManagedFileUrl(image)) return INVALID_IMAGE

    if (parentId) {
      const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { status: true } })
      if (!parent) return PARENT_NOT_FOUND
      if (parent.status === Status.ARCHIVED) return PARENT_ARCHIVED
    }

    if (await isNameTaken(parsed.data.name, parentId)) return NAME_EXISTS

    await prisma.category.create({
      // Placeholder: the Prisma hook generates the real slug from the name
      data: { ...parsed.data, slug: "" },
    })
    return { success: true }
  } catch (error) {
    if (isUniqueConstraintError(error)) return NAME_EXISTS
    if (isForeignKeyError(error)) return PARENT_NOT_FOUND
    return { success: false, error: formatError(error) }
  }
}

// Raised by the category_prevent_cycle trigger. Under the driver adapter its name only appears in the error meta.
function isCycleError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && JSON.stringify(error.meta ?? {}).includes("category_no_cycle")
}

export async function updateCategoryAction(input: z.input<typeof updateCategoryFormSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ category: ["update"] })

  try {
    const parsed = updateCategoryFormSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)

    const { id, ...data } = parsed.data

    if (data.image !== null && !isManagedFileUrl(data.image)) return INVALID_IMAGE

    const previous = await prisma.category.findUnique({ where: { id }, select: { image: true, parentId: true } })
    if (!previous) return NOT_FOUND

    // Only a new parent is checked, so a category whose parent was archived later can still be edited
    if (data.parentId && data.parentId !== previous.parentId) {
      // The trigger rejects deeper cycles; this one is cheap to catch with a clear message
      if (data.parentId === id) return PARENT_CYCLE
      const parent = await prisma.category.findUnique({ where: { id: data.parentId }, select: { status: true } })
      if (!parent) return PARENT_NOT_FOUND
      if (parent.status === Status.ARCHIVED) return PARENT_ARCHIVED
    }

    if (await isNameTaken(data.name, data.parentId, id)) return NAME_EXISTS

    await prisma.category.update({
      where: { id },
      data,
    })

    // Only the server knows the previous image, so it removes a replaced one once the update has been saved
    if (previous.image !== data.image) await removeFiles([previous.image])

    return { success: true }
  } catch (error) {
    if (isCycleError(error)) return PARENT_CYCLE
    if (isUniqueConstraintError(error)) return NAME_EXISTS
    if (isForeignKeyError(error)) return PARENT_NOT_FOUND
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NOT_FOUND
    return { success: false, error: formatError(error) }
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ category: ["delete"] })

  try {
    const parsed = categoryIdSchema.safeParse(categoryId)
    if (!parsed.success) return invalidInput(parsed.error)

    // The foreign key would reject this anyway, but with an error the form can't explain
    if ((await prisma.category.count({ where: { parentId: parsed.data } })) > 0) return HAS_CHILDREN

    // The Prisma hook removes the image after the delete commits
    await prisma.category.delete({
      where: { id: parsed.data },
    })
    return { success: true }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NOT_FOUND
    if (isForeignKeyError(error)) return HAS_CHILDREN
    return { success: false, error: formatError(error) }
  }
}
