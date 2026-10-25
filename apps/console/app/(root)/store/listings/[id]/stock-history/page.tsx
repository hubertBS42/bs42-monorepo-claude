import type { Metadata } from "next"
import { notFound } from "next/navigation"
import z from "zod"
import { StockMovementReason } from "@workspace/db/enums"
import { getEnumParam, getPositiveIntegerParam, getStringParam } from "@workspace/utils/search-params"
import BackButton from "@/components/back-button"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStockHistory, MAX_STOCK_HISTORY_PAGE_SIZE } from "@/lib/data/stock-history.data"
import StockHistoryTable from "./_components/stock-history-table"

export const metadata: Metadata = {
  title: "Stock History",
}

type StockHistoryPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

// Every change to a listing's stock, for any member of the store (as the listings are)
export default async function StockHistoryPage({ params, searchParams }: StockHistoryPageProps) {
  const { storeId } = await requireActiveStoreMember()

  const { id } = await params
  // StoreListing.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()
  const query = await searchParams
  const variantId = getStringParam(query.variantId)

  const response = await getStockHistory(storeId, id, {
    reason: getEnumParam(query.reason, Object.values(StockMovementReason)),
    variantId: variantId && z.uuid().safeParse(variantId).success ? variantId : undefined,
    page: getPositiveIntegerParam(query.page, 1),
    pageSize: getPositiveIntegerParam(query.pageSize, 20, MAX_STOCK_HISTORY_PAGE_SIZE),
  })
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }
  const { listing, movements } = response.data

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Stock History</h1>
          <p className="text-sm text-muted-foreground">{`Every change to ${listing.productName}'s stock here, newest first.`}</p>
        </div>
        <BackButton link={`/store/listings/${listing.id}/edit`} />
      </div>
      <StockHistoryTable data={movements} variants={listing.hasVariants ? listing.variants : null} />
    </div>
  )
}
