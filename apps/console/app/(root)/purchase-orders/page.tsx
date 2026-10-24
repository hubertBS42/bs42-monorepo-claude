import type { Metadata } from "next"
import z from "zod"
import { PurchaseOrderStatus } from "@workspace/db/enums"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import { requireConsoleAdmin } from "@/lib/auth-guard"
import { getPurchaseOrders, MAX_PURCHASE_ORDERS_PAGE_SIZE, PURCHASE_ORDER_SORT_FIELDS } from "@/lib/data/purchase-orders.data"
import { getStoresForSelect } from "@/lib/data/stores.data"
import type { PurchaseOrdersParams } from "@/types"
import PurchaseOrdersTable from "../store/purchase-orders/_components/purchase-orders-table"

export const metadata: Metadata = {
  title: "Purchase Orders",
}

type PurchaseOrdersPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

// Every store's purchase orders, read only: each store buys its own stock in, from its own suppliers
export default async function PlatformPurchaseOrdersPage({ searchParams }: PurchaseOrdersPageProps) {
  await requireConsoleAdmin()
  const params = await searchParams

  const storeId = getStringParam(params.storeId)
  const ordersParams: PurchaseOrdersParams = {
    reference: getStringParam(params.reference),
    status: getEnumParam(params.status, Object.values(PurchaseOrderStatus)),
    overdue: getEnumParam(params.overdue, ["true"]),
    // Organization.id is a uuid column, so anything else would make Prisma throw
    storeId: storeId && z.uuid().safeParse(storeId).success ? storeId : undefined,
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_PURCHASE_ORDERS_PAGE_SIZE),
    sort: getSortParam(params.sort, PURCHASE_ORDER_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const [result, stores] = await Promise.all([getPurchaseOrders(null, ordersParams), getStoresForSelect()])
  if (!result.success) throw new Error(result.error)
  if (!stores.success) throw new Error(stores.error)

  return (
    <main className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Purchase Orders</h1>
        <p className="text-sm text-muted-foreground">Every store&apos;s purchase orders, read-only.</p>
      </div>
      <PurchaseOrdersTable data={result.data} stores={stores.data} />
    </main>
  )
}
