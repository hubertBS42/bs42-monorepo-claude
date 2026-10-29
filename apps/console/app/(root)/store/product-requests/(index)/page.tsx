import type { Metadata } from "next"
import { ProductRequestStatus } from "@workspace/db/enums"
import { getEnumParam, getPositiveIntegerParam } from "@workspace/utils/search-params"
import ProductRequestsTable from "@/components/product-requests/product-requests-table"
import StoreAddButton from "@/components/store-add-button"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreProductRequests, MAX_PRODUCT_REQUESTS_PAGE_SIZE } from "@/lib/data/product-requests.data"

export const metadata: Metadata = {
  title: "Product Requests",
}

type ProductRequestsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// The store's requests for products the catalogue doesn't have, pending first
export default async function ProductRequestsPage({ searchParams }: ProductRequestsPageProps) {
  const { storeId } = await requireActiveStoreMember()
  const params = await searchParams

  const result = await getStoreProductRequests(storeId, {
    status: getEnumParam(params.status, Object.values(ProductRequestStatus)),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_PRODUCT_REQUESTS_PAGE_SIZE),
  })
  if (!result.success) throw new Error(result.error)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Product Requests</h1>
          <p className="text-sm text-muted-foreground">Products this store has asked the catalogue to add.</p>
        </div>

        <StoreAddButton
          storeId={storeId}
          label="Request a Product"
          url="/store/product-requests/new"
          permission={{ listing: ["create"] }}
          deniedText="Your role in this store can't request products."
        />
      </div>
      <ProductRequestsTable data={result.data} storeId={storeId} />
    </div>
  )
}
