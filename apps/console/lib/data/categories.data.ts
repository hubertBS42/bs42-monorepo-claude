import "server-only"

import type { CategoryNode } from "@/types"
import { formatError } from "@workspace/auth/format-error"
import { consoleAuth } from "@workspace/auth/console"
import { headers } from "next/headers"
import { prisma } from "@workspace/db"
import type { Category } from "@workspace/db/client"
import type { DataResponse } from "@workspace/contracts"

async function getSession() {
  return consoleAuth.api.getSession({
    headers: await headers(),
  })
}

// Nests each category under its parent in one pass. Siblings keep the input order, so sort before calling.
// A row whose parent is missing becomes a top-level row, so it can't silently disappear from the tree.
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(categories.map((category) => [category.id, { ...category, children: [] }]))
  const roots: CategoryNode[] = []

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return roots
}

// The whole hierarchy, unpaginated: a page boundary would cut subtrees apart
export const getCategoryTree = async (): Promise<DataResponse<CategoryNode[]>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }

    const categories = await prisma.category.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }, { id: "asc" }],
    })

    return { success: true, data: buildCategoryTree(categories) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
