import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import SupplierForm from "../_components/supplier-form"

export const metadata: Metadata = {
  title: "Add Supplier",
}

export default async function AddSupplierPage() {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ supplier: ["create"] }).success) redirect("/forbidden")

  return <SupplierForm storeId={storeId} supplier={null} />
}
