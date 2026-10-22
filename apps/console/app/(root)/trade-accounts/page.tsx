import type { Metadata } from "next"
import { BusinessType, TradeAccountStatus } from "@workspace/db/enums"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import TradeAccountsTable from "./_components/trade-accounts-table"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getTradeAccounts, MAX_TRADE_ACCOUNTS_PAGE_SIZE, TRADE_ACCOUNT_SORT_FIELDS } from "@/lib/data/trade-accounts.data"

export const metadata: Metadata = {
  title: "Trade Accounts",
}

type TradeAccountsPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

// Businesses that applied on the storefront: approve them with a discount, reject them with a reason
export default async function TradeAccountsPage({ searchParams }: TradeAccountsPageProps) {
  await requireSystemPermission({ tradeAccount: ["read"] })
  const params = await searchParams

  const result = await getTradeAccounts({
    search: getStringParam(params.search),
    status: getEnumParam(params.status, Object.values(TradeAccountStatus)),
    businessType: getEnumParam(params.businessType, Object.values(BusinessType)),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_TRADE_ACCOUNTS_PAGE_SIZE),
    sort: getSortParam(params.sort, TRADE_ACCOUNT_SORT_FIELDS),
    order: getOrderParam(params.order),
  })
  if (!result.success) throw new Error(result.error)

  return (
    <main className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Trade Accounts</h1>
        <p className="text-sm text-muted-foreground">Businesses apply on the storefront. An approved account gets its discount on every order, before tax.</p>
      </div>
      <TradeAccountsTable data={result.data} />
    </main>
  )
}
