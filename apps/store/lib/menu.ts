import "server-only"

import { categoryHref, type CategoryNode, type CategoryTree } from "@/lib/data/categories"

// The category menu: top categories, the ones under them, and one level more. Plain values for the menu's client
// components.
export interface MenuItem {
  name: string
  href: string
  children: MenuItem[]
}

export function getMenuItems(tree: CategoryTree): MenuItem[] {
  const item = (node: CategoryNode, levels: number): MenuItem => ({
    name: node.name,
    href: categoryHref(tree, node.id),
    children: levels > 1 ? node.children.map((child) => item(child, levels - 1)) : [],
  })
  return tree.roots.map((root) => item(root, 3))
}
