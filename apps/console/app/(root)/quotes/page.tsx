import type { Metadata } from "next"
import { getDayParam, getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import QuotesTable from "./_components/quotes-table"
import AddButton from "@/components/add-button"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getQuotes, MAX_QUOTES_PAGE_SIZE, QUOTE_SORT_FIELDS } from "@/lib/data/quotes.data"

export const metadata: Metadata = {
  title: "Quotes",
}

type QuotesPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

// Every quotation: those customers made from their basket and those staff made for them, for following up the ones
// not yet accepted
export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  await requireSystemPermission({ order: ["read"] })
  const params = await searchParams

  const result = await getQuotes({
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
  })
  if (!result.success) throw new Error(result.error)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Quotes</h1>
          <p className="text-sm text-muted-foreground">Quotations from customers and staff. Prices hold until they expire; stock isn&apos;t held.</p>
        </div>
        {/* Every role that reaches this page can make quotations (system permission order: create) */}
        <AddButton label="New Quotation" url="/quotes/create" />
      </div>
      <QuotesTable data={result.data} />
    </div>
  )
}
