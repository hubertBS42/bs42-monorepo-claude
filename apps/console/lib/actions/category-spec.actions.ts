"use server"
import { z } from "zod"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { SpecType } from "@workspace/db/enums"
import { formatError } from "@workspace/auth/format-error"
import { ActionResponse } from "@workspace/contracts"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getCategoryChain, getCategorySubtree } from "@/lib/product-specs"
import { categorySpecFormSchema, createCategorySpecSchema, deleteCategorySpecSchema, moveCategorySpecSchema, updateCategorySpecSchema } from "@/lib/schemas/category-spec.schemas"

// Every export here is a public endpoint, so every input is validated. Specs belong to the catalogue, so managing
// them needs the category permission.

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const CATEGORY_NOT_FOUND: ActionResponse = { success: false, error: "Category not found.", code: "NOT_FOUND" }
const NOT_FOUND: ActionResponse = { success: false, error: "This specification no longer exists.", code: "NOT_FOUND" }
const CONFLICT: ActionResponse = { success: false, error: "Someone else changed this specification. Refresh the page to see it.", code: "CONFLICT" }
const NAME_EXISTS: ActionResponse = { success: false, error: "This category, or one above or below it, already has a specification with this name.", code: "NAME_EXISTS" }
const TYPE_LOCKED: ActionResponse = { success: false, error: "A specification's type can't change. Delete it and add a new one.", code: "TYPE_LOCKED" }

type SpecInput = z.output<typeof categorySpecFormSchema>

// A product sees the specs of its category and every category above it, so a name can't repeat along a branch: above
// the category (what its products already have) or below it (what products further down have)
async function isNameTaken(categoryId: string, name: string, excludeId?: string) {
  const categories = await prisma.category.findMany({ select: { id: true, parentId: true } })
  const branch = [...getCategoryChain(categories, categoryId), ...getCategorySubtree(categories, categoryId).slice(1)]
  const existing = await prisma.categorySpec.findFirst({
    where: { categoryId: { in: branch }, name: { equals: name, mode: "insensitive" }, ...(excludeId && { id: { not: excludeId } }) },
    select: { id: true },
  })
  return !!existing
}

// A unit only means something on a number, and options on a choice
const typeFields = (spec: SpecInput) => ({ unit: spec.type === SpecType.NUMBER ? spec.unit : null, options: spec.type === SpecType.SELECT ? spec.options : [] })

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export async function createCategorySpecAction(input: z.input<typeof createCategorySpecSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ category: ["update"] })

  try {
    const parsed = createCategorySpecSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { categoryId, spec } = parsed.data

    if (!(await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) return CATEGORY_NOT_FOUND
    if (await isNameTaken(categoryId, spec.name)) return NAME_EXISTS

    const { unit, options } = typeFields(spec)
    const last = await prisma.categorySpec.aggregate({ where: { categoryId }, _max: { position: true } })
    await prisma.categorySpec.create({
      data: {
        categoryId,
        name: spec.name,
        type: spec.type,
        unit,
        isFilterable: spec.isFilterable,
        position: (last._max.position ?? -1) + 1,
        options: { create: options.map((option, position) => ({ value: option.value, position })) },
      },
    })
    return { success: true }
  } catch (error) {
    // The same name saved in the meantime
    if (isUniqueConstraintError(error)) return NAME_EXISTS
    return { success: false, error: formatError(error) }
  }
}

export async function updateCategorySpecAction(input: z.input<typeof updateCategorySpecSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ category: ["update"] })

  try {
    const parsed = updateCategorySpecSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { id, updatedAt, spec } = parsed.data

    const saved = await prisma.categorySpec.findUnique({ where: { id }, select: { categoryId: true, type: true, options: { select: { id: true } } } })
    if (!saved) return NOT_FOUND
    // Products' values are stored by type, so changing it would leave them meaningless
    if (saved.type !== spec.type) return TYPE_LOCKED
    if (await isNameTaken(saved.categoryId, spec.name, id)) return NAME_EXISTS

    const { unit, options } = typeFields(spec)
    const savedOptionIds = new Set(saved.options.map((option) => option.id))
    // An id that isn't one of this spec's options came from somewhere else
    if (options.some((option) => option.id && !savedOptionIds.has(option.id))) return CONFLICT
    const keptIds = new Set(options.flatMap((option) => (option.id ? [option.id] : [])))

    return await prisma.$transaction(
      async (tx) => {
        // Only from the version the page showed. Writing the spec row also moves updatedAt on for the next editor.
        const { count } = await tx.categorySpec.updateMany({ where: { id, updatedAt: new Date(updatedAt) }, data: { name: spec.name, unit, isFilterable: spec.isFilterable } })
        if (count === 0) return CONFLICT

        // Removing an option removes it from the products that had it
        await tx.categorySpecOption.deleteMany({ where: { specId: id, id: { notIn: [...keptIds] } } })
        // Two passes, so swapping two options' names doesn't trip the unique value on the way
        for (const optionId of keptIds) await tx.categorySpecOption.update({ where: { id: optionId }, data: { value: optionId } })
        for (const [position, option] of options.entries()) {
          if (option.id) await tx.categorySpecOption.update({ where: { id: option.id }, data: { value: option.value, position } })
          else await tx.categorySpecOption.create({ data: { specId: id, value: option.value, position } })
        }
        return { success: true } satisfies ActionResponse
      },
      { maxWait: 10_000, timeout: 30_000 }
    )
  } catch (error) {
    if (isUniqueConstraintError(error)) return NAME_EXISTS
    return { success: false, error: formatError(error) }
  }
}

// Removes the spec and every product's value for it
export async function deleteCategorySpecAction(input: z.input<typeof deleteCategorySpecSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ category: ["update"] })

  try {
    const parsed = deleteCategorySpecSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)

    const { count } = await prisma.categorySpec.deleteMany({ where: { id: parsed.data.id } })
    return count ? { success: true } : NOT_FOUND
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Moves a spec one place up or down among its category's
export async function moveCategorySpecAction(input: z.input<typeof moveCategorySpecSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ category: ["update"] })

  try {
    const parsed = moveCategorySpecSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { id, direction } = parsed.data

    const spec = await prisma.categorySpec.findUnique({ where: { id }, select: { categoryId: true } })
    if (!spec) return NOT_FOUND

    await prisma.$transaction(
      async (tx) => {
        const siblings = await tx.categorySpec.findMany({ where: { categoryId: spec.categoryId }, select: { id: true }, orderBy: [{ position: "asc" }, { name: "asc" }] })
        const order = siblings.map((sibling) => sibling.id)
        const from = order.indexOf(id)
        const to = direction === "up" ? from - 1 : from + 1
        if (from < 0 || to < 0 || to >= order.length) return
        ;[order[from], order[to]] = [order[to]!, order[from]!]
        // Renumbered from 0, so ties from before (all 0) don't stop the move
        for (const [position, siblingId] of order.entries()) await tx.categorySpec.update({ where: { id: siblingId }, data: { position } })
      },
      { maxWait: 10_000, timeout: 30_000 }
    )
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
