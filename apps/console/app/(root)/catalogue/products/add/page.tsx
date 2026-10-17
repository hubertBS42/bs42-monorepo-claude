import type { Metadata } from "next"
import ProductForm from "../_components/product-form"
import { getBrandsForSelect } from "@/lib/data/brands.data"
import { getCategoryOptions } from "@/lib/data/categories.data"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Add Product",
}

export default async function AddProductPage() {
  await requireSystemPermission({ product: ["create"] })

  const [brands, categories] = await Promise.all([getBrandsForSelect(), getCategoryOptions()])
  if (!brands.success) throw new Error(brands.error)
  if (!categories.success) throw new Error(categories.error)

  return <ProductForm brands={brands.data} categoryOptions={categories.data.options} disabledCategoryIds={categories.data.disabledIds} />
}
