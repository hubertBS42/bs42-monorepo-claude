import type { Metadata } from "next"
import { Status } from "@workspace/db/enums"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreListings, LISTING_SORT_FIELDS, MAX_LISTINGS_PAGE_SIZE } from "@/lib/data/listings.data"
import { getProductFilterOptions } from "@/lib/data/products.data"
import { LISTING_STOCK_STATES, type ListingsParams } from "@/types"
import StoreAddButton from "@/components/store-add-button"
import ListingsTable from "./_components/listings-table"

export const metadata: Metadata = {
  title: "Listings",
}

type StoreListingsPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function StoreListingsPage({ searchParams }: StoreListingsPageProps) {
  const { storeId } = await requireActiveStoreMember()
  const params = await searchParams

  const listingsParams: ListingsParams = {
    search: getStringParam(params.search),
    status: getEnumParam(params.status, Object.values(Status)),
    stock: getEnumParam(params.stock, LISTING_STOCK_STATES),
    brandId: getStringParam(params.brandId),
    categoryId: getStringParam(params.categoryId),
    visible: getEnumParam(params.visible, ["true", "false"]),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_LISTINGS_PAGE_SIZE),
    sort: getSortParam(params.sort, LISTING_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const [result, filterOptions] = await Promise.all([getStoreListings(storeId, listingsParams), getProductFilterOptions()])
  if (!result.success) throw new Error(result.error)
  if (!filterOptions.success) throw new Error(filterOptions.error)

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Listings</h1>
          <p className="text-sm text-muted-foreground">The catalogue products this store sells, with its own prices and stock.</p>
        </div>

        <StoreAddButton storeId={storeId} label="Add Listing" url="/store/listings/add" permission={{ listing: ["create"] }} deniedText="Your role in this store can't add listings." />
      </div>
      <ListingsTable data={result.data} filterOptions={filterOptions.data} />
    </main>
  )
}
