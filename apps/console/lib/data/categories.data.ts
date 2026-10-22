import "server-only"

import type { CategoryNode } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import type { Category } from "@workspace/db/client"
import { InstallationOption, Status } from "@workspace/db/enums"
import { installationFee, loadCategoryFees } from "@workspace/commerce/installation"
import type { DataResponse } from "@workspace/contracts"
import type { TreeSelectOption } from "@workspace/forms"
import { z } from "zod"

const categoryIdSchema = z.uuid()

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
}

// Nests each category under its parent in one pass. Siblings keep the input order, so sort before calling.
// A row whose parent is missing becomes a top-level row, so it can't silently disappear from the tree.
export function buildCategoryTree(categories: Omit<Category, "installationFeeGhs">[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(categories.map((category) => [category.id, { ...category, children: [] }]))
  const roots: CategoryNode[] = []

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return roots
}

// For the product form: each category's installation fee in GHS, its own or the nearest category's above it, so the
// form can name the fee a product in it would charge. Categories without one are left out.
export const getInstallationFeesByCategory = async (): Promise<DataResponse<Record<string, number>>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    const categories = await loadCategoryFees(prisma)
    const fees: Record<string, number> = {}
    for (const categoryId of categories.keys()) {
      const fee = installationFee({ installation: InstallationOption.CATEGORY, installationFeeGhs: null, categoryId }, categories)
      if (fee) fees[categoryId] = fee.toNumber()
    }
    return { success: true, data: fees }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// The whole hierarchy, unpaginated: a page boundary would cut subtrees apart
export const getCategoryTree = async (): Promise<DataResponse<CategoryNode[]>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    const categories = await prisma.category.findMany({
      omit: { installationFeeGhs: true },
      orderBy: [{ position: "asc" }, { name: "asc" }, { id: "asc" }],
    })

    return { success: true, data: buildCategoryTree(categories) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

function toTreeOptions(nodes: CategoryNode[]): TreeSelectOption[] {
  return nodes.map((node) => ({ label: node.name, value: node.id, children: toTreeOptions(node.children) }))
}

// The ids of a node and everything below it
function collectSubtreeIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(collectSubtreeIds)]
}

function findNode(nodes: CategoryNode[], id: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
  return undefined
}

// Options for the parent category select. Archived categories stay in the tree, so their subcategories keep their
// place, but are returned as disabledIds: an archived category can't take new subcategories. On an edit page, pass
// the category's id: it and its subcategories are disabled too, since moving it under them would make a cycle.
export const getCategoryOptions = async (editingId?: string): Promise<DataResponse<{ options: TreeSelectOption[]; disabledIds: string[] }>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    const categories = await prisma.category.findMany({
      omit: { installationFeeGhs: true },
      orderBy: [{ position: "asc" }, { name: "asc" }, { id: "asc" }],
    })

    const tree = buildCategoryTree(categories)
    const editing = editingId ? findNode(tree, editingId) : undefined
    const disabledIds = new Set([...categories.filter((category) => category.status === Status.ARCHIVED).map((category) => category.id), ...(editing ? collectSubtreeIds(editing) : [])])

    return {
      success: true,
      data: {
        options: toTreeOptions(tree),
        disabledIds: [...disabledIds],
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// childCount lets the edit page explain why a category can't be deleted yet
// The fee as a number: a Decimal can't reach the client form
export type CategoryForEdit = Omit<Category, "installationFeeGhs"> & { installationFeeGhs: number | null; childCount: number }

export const getCategoryById = async (categoryId: string): Promise<DataResponse<CategoryForEdit>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    // Category.id is a UUID column, so any other value would make Postgres throw instead of finding nothing
    if (!categoryIdSchema.safeParse(categoryId).success) return { success: false, error: "Category not found.", code: "NOT_FOUND" }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { childCategories: true } } },
    })

    if (!category) return { success: false, error: "Category not found.", code: "NOT_FOUND" }

    const { _count, ...rest } = category
    return { success: true, data: { ...rest, installationFeeGhs: rest.installationFeeGhs?.toNumber() ?? null, childCount: _count.childCategories } }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
