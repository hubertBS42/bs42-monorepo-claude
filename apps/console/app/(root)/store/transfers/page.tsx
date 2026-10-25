import type { Metadata } from "next"
import { StockTransferStatus } from "@workspace/db/enums"
import { getEnumParam, getPositiveIntegerParam } from "@workspace/utils/search-params"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStockTransfers, MAX_STOCK_TRANSFERS_PAGE_SIZE } from "@/lib/data/stock-transfers.data"
import SendStockButton from "./_components/send-stock-button"
import TransfersTable from "./_components/transfers-table"

export const metadata: Metadata = {
  title: "Transfers",
}

type TransfersPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Stock this store sent to its other stores, and stock they sent it
export default async function TransfersPage({ searchParams }: TransfersPageProps) {
  const { storeId } = await requireActiveStoreMember()
  const params = await searchParams

  const result = await getStockTransfers(storeId, {
    direction: getEnumParam(params.direction, ["out", "in"]),
    status: getEnumParam(params.status, Object.values(StockTransferStatus)),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_STOCK_TRANSFERS_PAGE_SIZE),
  })
  if (!result.success) throw new Error(result.error)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Transfers</h1>
          <p className="text-sm text-muted-foreground">Stock moved between this store and others.</p>
        </div>
        <SendStockButton storeId={storeId} />
      </div>
      <TransfersTable data={result.data} />
    </div>
  )
}
