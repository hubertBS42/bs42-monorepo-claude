import type { Metadata } from "next"
import EditCategoryForm from "./_components/edit-category-form"
import { requireSystemPermission } from "@/lib/auth-guard"
import { notFound } from "next/navigation"
import { getCategoryById, getCategoryOptions } from "@/lib/data/categories.data"

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
  const [response, options] = await Promise.all([getCategoryById(id), getCategoryOptions(id)])

  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }
  if (!options.success) throw new Error(options.error)

  return <EditCategoryForm category={response.data} parentOptions={options.data.options} disabledParentIds={options.data.disabledIds} />
}
