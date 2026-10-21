import "server-only"

import { unstable_cache } from "next/cache"
import { customerVisibleListingWhere, getVisibleCategoryIds } from "@workspace/commerce/visibility"
import { prisma } from "@workspace/db"

export interface CategoryRow {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  // Marked Featured in the console: a slide in the homepage's carousel
  isFeatured: boolean
  parentId: string | null
  // Products customers can buy here, in this category or under it
  productCount: number
}

export interface CategoryNode extends CategoryRow {
  children: CategoryNode[]
}

// The categories customers see (published, with everything above them published), siblings by position then name,
// with how many products each has on sale. One read of the whole tree, which is small.
const loadCategoryRows = unstable_cache(
  async (): Promise<CategoryRow[]> => {
    const rows = await prisma.category.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, description: true, image: true, isFeatured: true, parentId: true, status: true },
    })
    const visibleIds = getVisibleCategoryIds(rows)
    const counts = await prisma.product.groupBy({
      by: ["categoryId"],
      where: { storeListings: { some: customerVisibleListingWhere(visibleIds) } },
      _count: { _all: true },
    })
    const ownCount = new Map(counts.map((row) => [row.categoryId, row._count._all]))

    const visible = rows.filter((row) => visibleIds.has(row.id))
    const childrenOf = new Map<string | null, typeof visible>()
    for (const row of visible) childrenOf.set(row.parentId, [...(childrenOf.get(row.parentId) ?? []), row])
    const subtreeCount = (id: string): number => (ownCount.get(id) ?? 0) + (childrenOf.get(id) ?? []).reduce((total, child) => total + subtreeCount(child.id), 0)

    return visible.map(({ id, name, slug, description, image, isFeatured, parentId }) => ({ id, name, slug, description, image, isFeatured, parentId, productCount: subtreeCount(id) }))
  },
  ["store-categories"],
  { revalidate: 60 }
)

export interface CategoryTree {
  // Top-level categories with something on sale, each with its children that have
  roots: CategoryNode[]
  byId: Map<string, CategoryNode>
  bySlug: Map<string, CategoryNode>
}

// Categories with nothing on sale are left out, so the menu and pages never lead to an empty list
export async function getCategoryTree(): Promise<CategoryTree> {
  const rows = (await loadCategoryRows()).filter((row) => row.productCount > 0)
  const byId = new Map(rows.map((row): [string, CategoryNode] => [row.id, { ...row, children: [] }]))
  const roots: CategoryNode[] = []
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else if (!node.parentId) roots.push(node)
  }
  return { roots, byId, bySlug: new Map([...byId.values()].map((node) => [node.slug, node])) }
}

// The category and every one above it, top first
export function categoryPath(tree: CategoryTree, id: string) {
  const path: CategoryNode[] = []
  for (let node = tree.byId.get(id); node; node = node.parentId ? tree.byId.get(node.parentId) : undefined) path.unshift(node)
  return path
}

export function categoryHref(tree: CategoryTree, id: string) {
  return `/c/${categoryPath(tree, id)
    .map((node) => node.slug)
    .join("/")}`
}

export function subtreeIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(subtreeIds)]
}

// The specs a category's page filters by: its own and those of the categories above it, the top one's first, each
// category's by position then name
export const getFilterSpecs = unstable_cache(
  async (pathIds: string[]) => {
    const specs = await prisma.categorySpec.findMany({
      where: { categoryId: { in: pathIds }, isFilterable: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, categoryId: true },
    })
    return specs.sort((a, b) => pathIds.indexOf(a.categoryId) - pathIds.indexOf(b.categoryId))
  },
  ["store-filter-specs"],
  { revalidate: 60 }
)

// The homepage carousel's slides: featured categories with something on sale, in menu order (each top-level category,
// then the ones under it), at most this many
const MAX_FEATURED_CATEGORIES = 6

export function featuredCategories(tree: CategoryTree) {
  const inMenuOrder = (nodes: CategoryNode[]): CategoryNode[] => nodes.flatMap((node) => [node, ...inMenuOrder(node.children)])
  return inMenuOrder(tree.roots)
    .filter((node) => node.isFeatured)
    .slice(0, MAX_FEATURED_CATEGORIES)
}
