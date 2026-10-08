import { Metadata } from "next"
import EditStoreForm from "./_components/edit-store-form"
import { getStoreById } from "@/lib/data/stores.data"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Edit Store",
}

type Props = {
  params: Promise<{ id: string }>
}
export default async function EditStorePage({ params }: Props) {
  const { id } = await params
  const response = await getStoreById(id)

  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  return <EditStoreForm store={response.data} />
}
