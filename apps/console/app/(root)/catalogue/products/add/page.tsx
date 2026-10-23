import type { Metadata } from "next"
import ProductForm from "../_components/product-form"
import { getBrandsForSelect } from "@/lib/data/brands.data"
import { getCategoryOptions, getInstallationFeesByCategory } from "@/lib/data/categories.data"
import { getSpecFieldsByCategory } from "@/lib/data/category-specs.data"
import z from "zod"
import { getStringParam } from "@workspace/utils/search-params"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getProductRequestForProductForm } from "@/lib/data/product-requests.data"

export const metadata: Metadata = {
  title: "Add Product",
}

type AddProductPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// ?request= starts from a store's pending request (one dealt with since is ignored: the form starts empty)
export default async function AddProductPage({ searchParams }: AddProductPageProps) {
  await requireSystemPermission({ product: ["create"] })
  const requestId = getStringParam((await searchParams).request)
  const request = requestId && z.uuid().safeParse(requestId).success ? await getProductRequestForProductForm(requestId) : null

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
      request={request ?? undefined}
    />
  )
}
