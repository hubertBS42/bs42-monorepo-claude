import { Metadata } from "next"
import EditStoreForm from "./_components/edit-store-form"
import { getStoreById } from "@/lib/data/stores.data"
import { notFound } from "next/navigation"
import { requireOrganizationPermission, requireSystemPermission } from "@/lib/auth-guard"
import z from "zod"

export const metadata: Metadata = {
  title: "Edit Store",
}

type Props = {
  params: Promise<{ id: string }>
}
export default async function EditStorePage({ params }: Props) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  // System admins only, and only for stores they are a member of with update rights
  await requireSystemPermission({ organization: ["update"] })
  await requireOrganizationPermission(id, { organization: ["update"] })
  const response = await getStoreById(id)

  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  return <EditStoreForm store={response.data} />
}
