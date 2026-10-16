import type { Metadata } from "next"
import EditBrandForm from "./_components/edit-brand-form"
import { requireSystemPermission } from "@/lib/auth-guard"
import { notFound } from "next/navigation"
import { getBrandById } from "@/lib/data/brands.data"

export const metadata: Metadata = {
  title: "Edit Brand",
}

type Props = {
  params: Promise<{ id: string }>
}
export default async function EditBrandPage({ params }: Props) {
  await requireSystemPermission({ brand: ["update"] })

  const { id } = await params
  // getBrandById returns NOT_FOUND for an id that isn't a UUID
  const response = await getBrandById(id)

  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  return <EditBrandForm brand={response.data} />
}
