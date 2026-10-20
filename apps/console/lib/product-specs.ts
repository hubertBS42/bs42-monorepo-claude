import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { SpecType } from "@workspace/db/enums"
import { SPEC_NOT_SET } from "./schemas/category-spec.schemas"

// Category specs and products' values for them. A spec applies to products in its category and in every category
// under it. In its own module (like product-sync.ts) so it can be tested against the database without a session.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx

// How the product form holds a value: an option id, "true"/"false", text, or a number. "" (and the selects'
// SPEC_NOT_SET) means not set.
export type SpecFormValue = string | number

export interface CategoryRow {
  id: string
  parentId: string | null
}

// The category and every category above it, nearest first
export function getCategoryChain(categories: CategoryRow[], categoryId: string): string[] {
  const parents = new Map(categories.map((category) => [category.id, category.parentId]))
  const chain: string[] = []
  // The tree can't have cycles (a trigger refuses them); the length check only guards against a bad read
  for (let id: string | null | undefined = categoryId; id && chain.length <= categories.length; id = parents.get(id)) chain.push(id)
  return chain
}

// The category and every category under it
export function getCategorySubtree(categories: CategoryRow[], categoryId: string): string[] {
  const subtree = [categoryId]
  for (let index = 0; index < subtree.length; index++) {
    for (const category of categories) if (category.parentId === subtree[index]) subtree.push(category.id)
  }
  return subtree
}

const specSelect = {
  id: true,
  categoryId: true,
  name: true,
  type: true,
  unit: true,
  position: true,
  isFilterable: true,
  options: { select: { id: true, value: true }, orderBy: [{ position: "asc" }, { value: "asc" }] },
} satisfies Prisma.CategorySpecSelect

export type ApplicableSpec = Prisma.CategorySpecGetPayload<{ select: typeof specSelect }>

// The specs a product in this category can have: the top category's first, then down to the category's own, each
// category's in position order
export async function loadApplicableSpecs(client: Client, categoryId: string): Promise<ApplicableSpec[]> {
  const categories = await client.category.findMany({ select: { id: true, parentId: true } })
  const chain = getCategoryChain(categories, categoryId)
  const specs = await client.categorySpec.findMany({ where: { categoryId: { in: chain } }, select: specSelect, orderBy: [{ position: "asc" }, { name: "asc" }] })
  const depth = new Map(chain.map((id, index) => [id, index]))
  return specs.sort((a, b) => depth.get(b.categoryId)! - depth.get(a.categoryId)!)
}

export class SpecValueError extends Error {}

const isNotSet = (value: SpecFormValue | undefined) => value === undefined || value === "" || value === SPEC_NOT_SET

type SpecValueData = Pick<Prisma.ProductSpecValueCreateManyInput, "specId" | "optionId" | "numberValue" | "booleanValue" | "textValue">

// The rows to save for the form's values. Values for specs that don't apply (another category's, or one deleted
// since the page loaded) are dropped: there's nothing to save them against. Throws SpecValueError for a value that
// doesn't fit its spec.
export function toSpecValueRows(specs: ApplicableSpec[], values: Record<string, SpecFormValue>): SpecValueData[] {
  const rows: SpecValueData[] = []
  for (const spec of specs) {
    const value = values[spec.id]
    if (isNotSet(value)) continue

    switch (spec.type) {
      case SpecType.SELECT:
        // An option removed since the page loaded lands here too
        if (typeof value !== "string" || !spec.options.some((option) => option.id === value)) throw new SpecValueError(`Choose one of ${spec.name}'s options.`)
        rows.push({ specId: spec.id, optionId: value })
        break
      case SpecType.NUMBER:
        if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) >= 1e10) throw new SpecValueError(`Enter a number for ${spec.name}.`)
        rows.push({ specId: spec.id, numberValue: new Prisma.Decimal(value).toDecimalPlaces(4) })
        break
      case SpecType.BOOLEAN:
        if (value !== "true" && value !== "false") throw new SpecValueError(`Choose yes or no for ${spec.name}.`)
        rows.push({ specId: spec.id, booleanValue: value === "true" })
        break
      case SpecType.TEXT: {
        const text = typeof value === "string" ? value.trim() : ""
        if (text.length > 200) throw new SpecValueError(`${spec.name} can be at most 200 characters.`)
        if (text) rows.push({ specId: spec.id, textValue: text })
        break
      }
    }
  }
  return rows
}

// Replaces the product's values with the form's, for the specs its category has. Values for specs that no longer
// apply (it moved category) go too. Nothing points at a value, so replacing them is safe.
export async function saveProductSpecs(tx: Tx, productId: string, categoryId: string, values: Record<string, SpecFormValue>) {
  const rows = toSpecValueRows(await loadApplicableSpecs(tx, categoryId), values)
  await tx.productSpecValue.deleteMany({ where: { productId } })
  if (rows.length) await tx.productSpecValue.createMany({ data: rows.map((row) => ({ ...row, productId })) })
}

// A saved value as the form holds it
export function toSpecFormValue(value: { optionId: string | null; numberValue: Prisma.Decimal | null; booleanValue: boolean | null; textValue: string | null }): SpecFormValue {
  if (value.optionId) return value.optionId
  if (value.numberValue) return value.numberValue.toNumber()
  if (value.booleanValue !== null) return String(value.booleanValue)
  return value.textValue ?? ""
}
