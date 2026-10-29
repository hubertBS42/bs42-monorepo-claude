import type { Metadata } from "next"
import { redirect } from "next/navigation"
import z from "zod"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { PurchaseOrderStatus } from "@workspace/db/enums"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import StoreAddButton from "@/components/store-add-button"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getPurchaseOrders, getSupplierOptions, MAX_PURCHASE_ORDERS_PAGE_SIZE, PURCHASE_ORDER_SORT_FIELDS } from "@/lib/data/purchase-orders.data"
import type { PurchaseOrdersParams } from "@/types"
import PurchaseOrdersTable from "../_components/purchase-orders-table"

export const metadata: Metadata = {
  title: "Purchase Orders",
}

type PurchaseOrdersPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function PurchaseOrdersPage({ searchParams }: PurchaseOrdersPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ purchaseOrder: ["read"] }).success) redirect("/forbidden")
  const params = await searchParams

  const supplierId = getStringParam(params.supplierId)
  const ordersParams: PurchaseOrdersParams = {
    reference: getStringParam(params.reference),
    status: getEnumParam(params.status, Object.values(PurchaseOrderStatus)),
    // Supplier.id is a uuid column, so anything else would make Prisma throw
    supplierId: supplierId && z.uuid().safeParse(supplierId).success ? supplierId : undefined,
    overdue: getEnumParam(params.overdue, ["true"]),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_PURCHASE_ORDERS_PAGE_SIZE),
    sort: getSortParam(params.sort, PURCHASE_ORDER_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const [result, suppliers] = await Promise.all([getPurchaseOrders(storeId, ordersParams), getSupplierOptions(storeId, ordersParams.supplierId)])
  if (!result.success) throw new Error(result.error)
  if (!suppliers.success) throw new Error(suppliers.error)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">Stock ordered from suppliers.</p>
        </div>

        <StoreAddButton
          storeId={storeId}
          label="Create Purchase Order"
          url="/store/purchase-orders/create"
          permission={{ purchaseOrder: ["create"] }}
          deniedText="Your role in this store can't create purchase orders."
        />
      </div>
      <PurchaseOrdersTable data={result.data} suppliers={suppliers.data} />
    </div>
  )
}
