import { requireConsoleAdmin } from "@/lib/auth-guard"
import type { Metadata } from "next"
import type { ProductsParams } from "@/types"
import { getProductsForTable, MAX_PRODUCTS_PAGE_SIZE, PRODUCT_SORT_FIELDS } from "@/lib/data/products.data"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import AddButton from "@/components/add-button"
import ProductsTable from "./_components/products-table"
import { Status } from "@workspace/db/enums"

export const metadata: Metadata = { title: "Manage Products" }

type ProductsPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  await requireConsoleAdmin()
  const params = await searchParams

  const productsParams: ProductsParams = {
    name: getStringParam(params.name),
    status: getEnumParam(params.status, Object.values(Status)),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_PRODUCTS_PAGE_SIZE),
    sort: getSortParam(params.sort, PRODUCT_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const result = await getProductsForTable(productsParams)
  if (!result.success) throw new Error(result.error)

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Manage Products</h1>
          <p className="text-sm text-muted-foreground">View and manage all products.</p>
        </div>

        <AddButton label="Add Product" url="/catalogue/products/add" />
      </div>
      <ProductsTable data={result.data} />
    </main>
  )
}
