"use client"
import { DataTableTree } from "@workspace/tables"
import type { CategoryNode } from "@/types"
import { columns } from "./columns"

interface CategoriesTableProps {
  // Top-level categories with their subcategories nested, from getCategoryTree
  data: CategoryNode[]
}

const CategoriesTable = ({ data }: CategoriesTableProps) => {
  return <DataTableTree columns={columns} data={data} getSubRows={(category) => category.children} getRowHref={(category) => `/catalogue/categories/${category.id}/edit`} />
}

export default CategoriesTable
