import "server-only"

import type { CategorySpecsData, SpecField } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import type { DataResponse } from "@workspace/contracts"
import { z } from "zod"
import { getCategoryChain } from "@/lib/product-specs"

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
}

const fieldSelect = {
  id: true,
  categoryId: true,
  name: true,
  type: true,
  unit: true,
  options: { select: { id: true, value: true }, orderBy: [{ position: "asc" as const }, { value: "asc" as const }] },
}
const specOrder = [{ position: "asc" as const }, { name: "asc" as const }]

const toField = ({ id, name, type, unit, options }: SpecField): SpecField => ({ id, name, type, unit, options })

// For the category's edit page: its own specs, with how many products have a value, and the ones it inherits
export const getCategorySpecs = async (categoryId: string): Promise<DataResponse<CategorySpecsData>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (!z.uuid().safeParse(categoryId).success) return { success: false, error: "Category not found.", code: "NOT_FOUND" }

    const categories = await prisma.category.findMany({ select: { id: true, parentId: true, name: true } })
    const above = getCategoryChain(categories, categoryId).slice(1).reverse()
    const names = new Map(categories.map((category) => [category.id, category.name]))

    const [own, inherited] = await Promise.all([
      prisma.categorySpec.findMany({
        where: { categoryId },
        select: { ...fieldSelect, isFilterable: true, updatedAt: true, _count: { select: { values: true } } },
        orderBy: specOrder,
      }),
      prisma.categorySpec.findMany({ where: { categoryId: { in: above } }, select: fieldSelect, orderBy: specOrder }),
    ])

    return {
      success: true,
      data: {
        own: own.map((spec) => ({ ...toField(spec), isFilterable: spec.isFilterable, updatedAt: spec.updatedAt.toISOString(), productCount: spec._count.values })),
        // Top category first, as the product form lists them
        inherited: above.flatMap((id) => inherited.filter((spec) => spec.categoryId === id).map((spec) => ({ ...toField(spec), categoryName: names.get(id) ?? "" }))),
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// For the product form: every category's specs, its own and those above it, so the form can follow the category
// field without asking the server. The tree and its specs are small.
export const getSpecFieldsByCategory = async (): Promise<DataResponse<Record<string, SpecField[]>>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    const [categories, specs] = await Promise.all([prisma.category.findMany({ select: { id: true, parentId: true } }), prisma.categorySpec.findMany({ select: fieldSelect, orderBy: specOrder })])
    const byCategory = new Map<string, typeof specs>()
    for (const spec of specs) byCategory.set(spec.categoryId, [...(byCategory.get(spec.categoryId) ?? []), spec])

    const fields: Record<string, SpecField[]> = {}
    for (const category of categories) {
      // Top category first, down to the category's own
      const chain = getCategoryChain(categories, category.id).reverse()
      const own = chain.flatMap((id) => (byCategory.get(id) ?? []).map(toField))
      if (own.length) fields[category.id] = own
    }
    return { success: true, data: fields }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
