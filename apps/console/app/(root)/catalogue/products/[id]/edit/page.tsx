import type { Metadata } from "next"
import { notFound } from "next/navigation"
import ProductForm from "../../_components/product-form"
import { getBrandsForSelect } from "@/lib/data/brands.data"
import { getCategoryOptions, getInstallationFeesByCategory } from "@/lib/data/categories.data"
import { getSpecFieldsByCategory } from "@/lib/data/category-specs.data"
import { getProductForEdit } from "@/lib/data/products.data"
import { getProductReviewStats } from "@/lib/data/reviews.data"
import { getProductStorefrontLink } from "@/lib/data/storefront-links.data"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Edit Product",
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: Props) {
  await requireSystemPermission({ product: ["update"] })

  const { id } = await params
  // getProductForEdit returns NOT_FOUND for an id that isn't a UUID
  const [product, brands, categories, specFields, installationFees] = await Promise.all([
    getProductForEdit(id),
    getBrandsForSelect(),
    getCategoryOptions(),
    getSpecFieldsByCategory(),
    getInstallationFeesByCategory(),
  ])

  if (!product.success) {
    if (product.code === "NOT_FOUND") notFound()
    throw new Error(product.error)
  }
  if (!brands.success) throw new Error(brands.error)
  if (!categories.success) throw new Error(categories.error)
  if (!specFields.success) throw new Error(specFields.error)
  if (!installationFees.success) throw new Error(installationFees.error)

  // getBrandsForSelect leaves archived brands out, which would leave this product's brand field empty. It's offered
  // so the form shows it; saving still asks for an active brand.
  const { brand } = product.data
  const [storefrontLink, reviewStats] = await Promise.all([getProductStorefrontLink(product.data.id), getProductReviewStats(product.data.id)])
  const brandOptions = brand.isArchived ? [...brands.data, { id: brand.id, name: `${brand.name} (archived)` }] : brands.data

  return (
    <ProductForm
      product={product.data}
      brands={brandOptions}
      categoryOptions={categories.data.options}
      disabledCategoryIds={categories.data.disabledIds}
      specFields={specFields.data}
      categoryInstallationFees={installationFees.data}
      storefrontLink={storefrontLink}
      reviewStats={reviewStats}
    />
  )
}
