import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreOrders, MAX_STORE_ORDERS_PAGE_SIZE, STORE_ORDER_SORT_FIELDS } from "@/lib/data/store-orders.data"
import type { StoreOrdersParams } from "@/types"
import OrdersTable from "./_components/orders-table"

export const metadata: Metadata = {
  title: "Manage Orders",
}

type StoreOrdersPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function StoreOrdersPage({ searchParams }: StoreOrdersPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["read"] }).success) redirect("/forbidden")
  const params = await searchParams

  const ordersParams: StoreOrdersParams = {
    reference: getStringParam(params.reference),
    status: getEnumParam(params.status, Object.values(OrderStatus)),
    paymentStatus: getEnumParam(params.paymentStatus, Object.values(PaymentStatus)),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_STORE_ORDERS_PAGE_SIZE),
    sort: getSortParam(params.sort, STORE_ORDER_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const result = await getStoreOrders(storeId, ordersParams)
  if (!result.success) throw new Error(result.error)

  return (
    <main className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Manage Orders</h1>
        <p className="text-sm text-muted-foreground">Orders with this store&apos;s items. An order with other stores&apos; items too is managed by the platform.</p>
      </div>
      <OrdersTable data={result.data} />
    </main>
  )
}
