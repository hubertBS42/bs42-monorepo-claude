import type { Metadata } from "next"
import AddCategoryForm from "./_components/add-category-form"
import { getCategoryOptions } from "@/lib/data/categories.data"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Add Category",
}
export default async function AddCategoryPage() {
  await requireSystemPermission({ category: ["create"] })

  const result = await getCategoryOptions()
  if (!result.success) throw new Error(result.error)

  return <AddCategoryForm parentOptions={result.data.options} disabledParentIds={result.data.disabledIds} />
}
