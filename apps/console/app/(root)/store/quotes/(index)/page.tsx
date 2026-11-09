import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { getDayParam, getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import QuotesTable from "@/components/quotes/quotes-table"
import StoreAddButton from "@/components/store-add-button"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getQuotes, MAX_QUOTES_PAGE_SIZE, QUOTE_SORT_FIELDS } from "@/lib/data/quotes.data"

export const metadata: Metadata = {
  title: "Quotes",
}

type StoreQuotesPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

// The quotations for this store's items: those its staff made, and any other made entirely of its items
export default async function StoreQuotesPage({ searchParams }: StoreQuotesPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["read"] }).success) redirect("/forbidden")
  const params = await searchParams

  const result = await getQuotes(
    {
      search: getStringParam(params.search),
      status: getEnumParam(params.status, ["open", "expired", "accepted", "cancelled"]),
      trade: getEnumParam(params.trade, ["true", "false"]),
      madeStart: getDayParam(params.madeStart),
      madeEnd: getDayParam(params.madeEnd),
      madeBy: getEnumParam(params.madeBy, ["customer", "staff"]),
      page: getPositiveIntegerParam(params.page, 1),
      pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_QUOTES_PAGE_SIZE),
      sort: getSortParam(params.sort, QUOTE_SORT_FIELDS),
      order: getOrderParam(params.order),
    },
    storeId
  )
  if (!result.success) throw new Error(result.error)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Quotes</h1>
          <p className="text-sm text-muted-foreground">Quotations for this store&apos;s items. Prices hold until they expire; stock isn&apos;t held.</p>
        </div>
        <StoreAddButton storeId={storeId} label="New Quotation" url="/store/quotes/create" permission={{ order: ["create"] }} deniedText="Your role in this store can't make quotations." />
      </div>
      <QuotesTable data={result.data} storeId={storeId} />
    </div>
  )
}
