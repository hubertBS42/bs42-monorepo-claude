import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import AddButton from "@/components/add-button"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreOrders, MAX_STORE_ORDERS_PAGE_SIZE, STORE_ORDER_SORT_FIELDS } from "@/lib/data/store-orders.data"
import type { StoreOrdersParams } from "@/types"
import OrdersTable from "../_components/orders-table"

export const metadata: Metadata = {
  title: "Orders",
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
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Orders</h1>
          <p className="text-sm text-muted-foreground">Orders with this store&apos;s items. Mixed-store orders are managed by the platform.</p>
        </div>

        {/* Every store role can create orders */}
        <AddButton label="Create Order" url="/store/orders/create" />
      </div>
      <OrdersTable data={result.data} />
    </div>
  )
}
