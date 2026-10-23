import type { Metadata } from "next"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { getDayParam, getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import AddButton from "@/components/add-button"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getOrders, MAX_ORDERS_PAGE_SIZE, ORDER_SORT_FIELDS } from "@/lib/data/orders.data"
import { getStoresForSelect } from "@/lib/data/stores.data"
import type { OrdersParams } from "@/types"
import OrdersTable from "./_components/orders-table"

export const metadata: Metadata = {
  title: "Orders",
}

type OrdersPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  await requireSystemPermission({ order: ["read"] })
  const params = await searchParams

  const ordersParams: OrdersParams = {
    reference: getStringParam(params.reference),
    customer: getStringParam(params.customer),
    storeId: getStringParam(params.storeId),
    status: getEnumParam(params.status, Object.values(OrderStatus)),
    paymentStatus: getEnumParam(params.paymentStatus, Object.values(PaymentStatus)),
    multiStore: getEnumParam(params.multiStore, ["true", "false"]),
    returned: getEnumParam(params.returned, ["true", "false"]),
    trade: getEnumParam(params.trade, ["true", "false"]),
    placedStart: getDayParam(params.placedStart),
    placedEnd: getDayParam(params.placedEnd),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_ORDERS_PAGE_SIZE),
    sort: getSortParam(params.sort, ORDER_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const [result, stores] = await Promise.all([getOrders(ordersParams), getStoresForSelect()])
  if (!result.success) throw new Error(result.error)
  if (!stores.success) throw new Error(stores.error)

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Every order from every store, including those with more than one store&apos;s items. Refunds and returns can be given on any order here; stores handle those on their own orders.
          </p>
        </div>
        {/* Every role that reaches this page can create orders (system permission order: create) */}
        <AddButton label="Create Order" url="/orders/create" />
      </div>
      <OrdersTable data={result.data} stores={stores.data.map((store) => ({ label: store.name, value: store.id }))} />
    </main>
  )
}
