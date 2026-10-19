import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import z from "zod"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getSupplierById } from "@/lib/data/suppliers.data"
import SupplierForm from "../../_components/supplier-form"

export const metadata: Metadata = {
  title: "Edit Supplier",
}

type EditSupplierPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ supplier: ["update"] }).success) redirect("/forbidden")

  const { id } = await params
  // Supplier.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getSupplierById(storeId, id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  return <SupplierForm storeId={storeId} supplier={response.data} />
}
