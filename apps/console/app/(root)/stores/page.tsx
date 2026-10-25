import type { Metadata } from "next"
import StoresTable from "./_components/stores-table"
import { getStores, MAX_STORES_PAGE_SIZE, STORE_SORT_FIELDS } from "@/lib/data/stores.data"
import AddButton from "@/components/add-button"
import { StoreStatus, type StoresParams } from "@/types"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import { requireConsoleAdmin } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Stores",
}

type StoresPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function StoresPage({ searchParams }: StoresPageProps) {
  await requireConsoleAdmin()
  const params = await searchParams

  const storesParams: StoresParams = {
    name: getStringParam(params.name),
    status: getEnumParam(params.status, Object.values(StoreStatus)),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_STORES_PAGE_SIZE),
    sort: getSortParam(params.sort, STORE_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const result = await getStores(storesParams)
  if (!result.success) throw new Error(result.error)
  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Stores</h1>
          <p className="text-sm text-muted-foreground">View and manage all stores.</p>
        </div>

        <AddButton label="Add Store" url="/stores/add" />
      </div>
      <StoresTable data={result.data} />
    </div>
  )
}
