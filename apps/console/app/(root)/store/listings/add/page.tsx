import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import z from "zod"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { getPositiveIntegerParam, getStringParam } from "@workspace/utils/search-params"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getListableProducts, getListingIdForProduct, getNewListingFormData, LISTABLE_PRODUCTS_STEP, MAX_LISTABLE_PRODUCTS } from "@/lib/data/listings.data"
import ListingForm from "../_components/listing-form"
import ProductPicker from "./_components/product-picker"

export const metadata: Metadata = {
  title: "Add Listing",
}

type AddListingPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

// Two steps on one page: pick a product, then set the store's prices and stock for it (?productId=)
export default async function AddListingPage({ searchParams }: AddListingPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ listing: ["create"] }).success) redirect("/forbidden")

  const params = await searchParams
  const productId = getStringParam(params.productId)

  if (!productId) {
    const search = getStringParam(params.search)
    const limit = getPositiveIntegerParam(params.limit, LISTABLE_PRODUCTS_STEP, MAX_LISTABLE_PRODUCTS)
    const result = await getListableProducts(storeId, search, limit)
    if (!result.success) throw new Error(result.error)

    const { products, total } = result.data
    const nextLimit = total > products.length && limit < MAX_LISTABLE_PRODUCTS ? Math.min(limit + LISTABLE_PRODUCTS_STEP, MAX_LISTABLE_PRODUCTS) : null

    return (
      <main className="flex flex-col gap-y-6">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Add Listing</h1>
          <p className="text-sm text-muted-foreground">
            Choose a published catalogue product this store doesn&apos;t list yet. Can&apos;t find it?{" "}
            <Link href="/store/product-requests/new" className="font-medium text-foreground underline-offset-4 hover:underline">
              Request it
            </Link>
          </p>
        </div>
        <ProductPicker products={products} total={total} search={search} nextLimit={nextLimit} />
      </main>
    )
  }

  // Product.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(productId).success) notFound()

  const response = await getNewListingFormData(storeId, productId)
  if (!response.success) {
    // Listed already, perhaps from another tab: edit that listing instead
    if (response.code === "ALREADY_LISTED") {
      const listingId = await getListingIdForProduct(storeId, productId)
      if (listingId) redirect(`/store/listings/${listingId}/edit`)
    }
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  return <ListingForm storeId={storeId} data={response.data} />
}
