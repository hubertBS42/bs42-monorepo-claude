import type { Metadata } from "next"
import EditCategoryForm from "./_components/edit-category-form"
import CategorySpecs from "./_components/category-specs"
import { requireSystemPermission } from "@/lib/auth-guard"
import { notFound } from "next/navigation"
import { getCategoryById, getCategoryOptions } from "@/lib/data/categories.data"
import { getCategorySpecs } from "@/lib/data/category-specs.data"

export const metadata: Metadata = {
  title: "Edit Category",
}

type Props = {
  params: Promise<{ id: string }>
}
export default async function EditCategoryPage({ params }: Props) {
  await requireSystemPermission({ category: ["update"] })

  const { id } = await params
  // getCategoryById returns NOT_FOUND for an id that isn't a UUID
  const [response, options, specs] = await Promise.all([getCategoryById(id), getCategoryOptions(id), getCategorySpecs(id)])

  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }
  if (!options.success) throw new Error(options.error)
  if (!specs.success) throw new Error(specs.error)

  return (
    <div className="grid gap-8">
      <EditCategoryForm category={response.data} parentOptions={options.data.options} disabledParentIds={options.data.disabledIds} />
      {/* Outside the form: each change saves on its own */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CategorySpecs categoryId={response.data.id} specs={specs.data} />
        </div>
      </div>
    </div>
  )
}
