import type { Metadata } from "next"
import ProductForm from "../_components/product-form"
import { getBrandsForSelect } from "@/lib/data/brands.data"
import { getCategoryOptions, getInstallationFeesByCategory } from "@/lib/data/categories.data"
import { getSpecFieldsByCategory } from "@/lib/data/category-specs.data"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Add Product",
}

export default async function AddProductPage() {
  await requireSystemPermission({ product: ["create"] })

  const [brands, categories, specFields, installationFees] = await Promise.all([getBrandsForSelect(), getCategoryOptions(), getSpecFieldsByCategory(), getInstallationFeesByCategory()])
  if (!brands.success) throw new Error(brands.error)
  if (!installationFees.success) throw new Error(installationFees.error)
  if (!categories.success) throw new Error(categories.error)
  if (!specFields.success) throw new Error(specFields.error)

  return (
    <ProductForm
      brands={brands.data}
      categoryOptions={categories.data.options}
      disabledCategoryIds={categories.data.disabledIds}
      specFields={specFields.data}
      categoryInstallationFees={installationFees.data}
    />
  )
}
