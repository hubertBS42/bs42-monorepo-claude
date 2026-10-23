import { requireConsoleAdmin } from "@/lib/auth-guard"
import type { Metadata } from "next"
import type { ProductsParams } from "@/types"
import { getCategoryOptions } from "@/lib/data/categories.data"
import { getProductFilterOptions, getProductsForTable, MAX_PRODUCTS_PAGE_SIZE, PRODUCT_SORT_FIELDS } from "@/lib/data/products.data"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import AddButton from "@/components/add-button"
import ProductsTable from "./_components/products-table"
import { Condition, Status } from "@workspace/db/enums"
import { z } from "zod"

// The ids go straight into a uuid column, where anything else is a database error rather than "no match"
const getUuidParam = (value: string | string[] | undefined) => {
  const id = getStringParam(value)
  return id && z.uuid().safeParse(id).success ? id : undefined
}

export const metadata: Metadata = { title: "Products" }

type ProductsPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  await requireConsoleAdmin()
  const params = await searchParams

  const productsParams: ProductsParams = {
    search: getStringParam(params.search),
    status: getEnumParam(params.status, Object.values(Status)),
    brandId: getUuidParam(params.brandId),
    categoryId: getUuidParam(params.categoryId),
    condition: getEnumParam(params.condition, Object.values(Condition)),
    hasVariants: { true: true, false: false, none: undefined }[getEnumParam(params.hasVariants, ["true", "false"]) ?? "none"],
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_PRODUCTS_PAGE_SIZE),
    sort: getSortParam(params.sort, PRODUCT_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const [result, filterOptions, categories] = await Promise.all([getProductsForTable(productsParams), getProductFilterOptions(), getCategoryOptions()])
  if (!result.success) throw new Error(result.error)
  if (!filterOptions.success) throw new Error(filterOptions.error)
  if (!categories.success) throw new Error(categories.error)

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Products</h1>
          <p className="text-sm text-muted-foreground">View and manage all products.</p>
        </div>

        <AddButton label="Add Product" url="/catalogue/products/add" />
      </div>
      <ProductsTable data={result.data} filterOptions={filterOptions.data} categoryChoices={{ options: categories.data.options, disabledIds: categories.data.disabledIds }} />
    </main>
  )
}
