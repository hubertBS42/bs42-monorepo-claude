import type { Metadata } from "next"
import { getDayParam, getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import QuotesTable from "./_components/quotes-table"
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

// Customers' quotations, for following up the ones not yet accepted. Customers make, accept and cancel them on the
// storefront, so this page only reads.
export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  await requireSystemPermission({ order: ["read"] })
  const params = await searchParams

  const result = await getQuotes({
    search: getStringParam(params.search),
    status: getEnumParam(params.status, ["open", "expired", "accepted", "cancelled"]),
    trade: getEnumParam(params.trade, ["true", "false"]),
    madeStart: getDayParam(params.madeStart),
    madeEnd: getDayParam(params.madeEnd),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_QUOTES_PAGE_SIZE),
    sort: getSortParam(params.sort, QUOTE_SORT_FIELDS),
    order: getOrderParam(params.order),
  })
  if (!result.success) throw new Error(result.error)

  return (
    <main className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Quotes</h1>
        <p className="text-sm text-muted-foreground">Quotations customers made from their basket. Prices hold until each one lapses; stock isn&apos;t held. Accepting one places an order.</p>
      </div>
      <QuotesTable data={result.data} />
    </main>
  )
}
