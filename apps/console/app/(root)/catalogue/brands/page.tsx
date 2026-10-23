import type { Metadata } from "next"
import BrandsTable from "./_components/brands-table"
import { getBrands, MAX_BRANDS_PAGE_SIZE, BRAND_SORT_FIELDS } from "@/lib/data/brands.data"
import AddButton from "@/components/add-button"
import { Status } from "@workspace/db/enums"
import type { BrandsParams } from "@/types"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import { requireConsoleAdmin } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Brands",
}

type BrandsPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function BrandsPage({ searchParams }: BrandsPageProps) {
  await requireConsoleAdmin()
  const params = await searchParams

  const brandsParams: BrandsParams = {
    name: getStringParam(params.name),
    status: getEnumParam(params.status, Object.values(Status)),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_BRANDS_PAGE_SIZE),
    sort: getSortParam(params.sort, BRAND_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const result = await getBrands(brandsParams)
  if (!result.success) throw new Error(result.error)
  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Brands</h1>
          <p className="text-sm text-muted-foreground">View and manage all brands.</p>
        </div>

        <AddButton label="Add Brand" url="/catalogue/brands/add" />
      </div>
      <BrandsTable data={result.data} />
    </main>
  )
}
