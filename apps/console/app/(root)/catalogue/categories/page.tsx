import type { Metadata } from "next"
import CategoriesTable from "./_components/categories-table"
import { getCategoryTree } from "@/lib/data/categories.data"
import AddButton from "@/components/add-button"
import { requireConsoleAdmin } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Categories",
}

export default async function CategoriesPage() {
  await requireConsoleAdmin()

  const result = await getCategoryTree()
  if (!result.success) throw new Error(result.error)
  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Categories</h1>
          <p className="text-sm text-muted-foreground">View and manage all categories and their subcategories.</p>
        </div>

        <AddButton label="Add Category" url="/catalogue/categories/add" />
      </div>
      <CategoriesTable data={result.data} />
    </main>
  )
}
