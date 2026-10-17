import type { Metadata } from "next"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { Status } from "@workspace/db/enums"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import AddButton from "@/components/add-button"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreListings, LISTING_SORT_FIELDS, MAX_LISTINGS_PAGE_SIZE } from "@/lib/data/listings.data"
import type { ListingsParams } from "@/types"
import ListingsTable from "./_components/listings-table"

export const metadata: Metadata = {
  title: "Manage Listings",
}

type StoreListingsPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function StoreListingsPage({ searchParams }: StoreListingsPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  const params = await searchParams

  const listingsParams: ListingsParams = {
    search: getStringParam(params.search),
    status: getEnumParam(params.status, Object.values(Status)),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_LISTINGS_PAGE_SIZE),
    sort: getSortParam(params.sort, LISTING_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const result = await getStoreListings(storeId, listingsParams)
  if (!result.success) throw new Error(result.error)

  // createListingAction checks again
  const canCreate = organizationRoles[role].authorize({ listing: ["create"] }).success

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Manage Listings</h1>
          <p className="text-sm text-muted-foreground">The catalogue products this store sells, with its own prices and stock.</p>
        </div>

        {canCreate && <AddButton label="Add Listing" url="/store/listings/add" />}
      </div>
      <ListingsTable data={result.data} />
    </main>
  )
}
