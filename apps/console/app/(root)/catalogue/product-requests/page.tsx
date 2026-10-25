import type { Metadata } from "next"
import z from "zod"
import { ProductRequestStatus } from "@workspace/db/enums"
import { getEnumParam, getPositiveIntegerParam, getStringParam } from "@workspace/utils/search-params"
import ProductRequestsTable from "@/components/product-requests/product-requests-table"
import { requireConsoleAdmin } from "@/lib/auth-guard"
import { getProductRequests, MAX_PRODUCT_REQUESTS_PAGE_SIZE } from "@/lib/data/product-requests.data"
import { getStoresForSelect } from "@/lib/data/stores.data"

export const metadata: Metadata = {
  title: "Product Requests",
}

type ProductRequestsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Every store's requests for products the catalogue doesn't have, the pending ones first, oldest first
export default async function PlatformProductRequestsPage({ searchParams }: ProductRequestsPageProps) {
  await requireConsoleAdmin()
  const params = await searchParams

  const storeId = getStringParam(params.storeId)
  const [result, stores] = await Promise.all([
    getProductRequests({
      status: getEnumParam(params.status, Object.values(ProductRequestStatus)),
      // A uuid column: anything else would make Prisma throw instead of matching nothing
      storeId: storeId && z.uuid().safeParse(storeId).success ? storeId : undefined,
      page: getPositiveIntegerParam(params.page, 1),
      pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_PRODUCT_REQUESTS_PAGE_SIZE),
    }),
    getStoresForSelect(),
  ])
  if (!result.success) throw new Error(result.error)
  if (!stores.success) throw new Error(stores.error)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Product Requests</h1>
        <p className="text-sm text-muted-foreground">Products stores have asked the catalogue to add.</p>
      </div>
      <ProductRequestsTable data={result.data} stores={stores.data} />
    </div>
  )
}
