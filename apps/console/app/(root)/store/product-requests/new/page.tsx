import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getBrandsForSelect } from "@/lib/data/brands.data"
import { getCategoryOptions } from "@/lib/data/categories.data"
import ProductRequestForm from "./_components/product-request-form"

export const metadata: Metadata = {
  title: "Request a Product",
}

export default async function NewProductRequestPage() {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ listing: ["create"] }).success) redirect("/forbidden")

  const [brands, categories] = await Promise.all([getBrandsForSelect(), getCategoryOptions()])
  if (!brands.success) throw new Error(brands.error)
  if (!categories.success) throw new Error(categories.error)

  return <ProductRequestForm storeId={storeId} brands={brands.data} categories={categories.data} />
}
