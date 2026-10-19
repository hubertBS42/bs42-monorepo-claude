import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import z from "zod"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getLatestExchangeRate } from "@/lib/data/exchange-rates.data"
import { getPurchaseOrderDetails, getSupplierOptions } from "@/lib/data/purchase-orders.data"
import { isEditablePurchaseOrder } from "@/lib/purchase-order-status"
import PurchaseOrderForm from "../../_components/purchase-order-form"

export const metadata: Metadata = {
  title: "Edit Purchase Order",
}

type EditPurchaseOrderPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditPurchaseOrderPage({ params }: EditPurchaseOrderPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ purchaseOrder: ["update"] }).success) redirect("/forbidden")

  const { id } = await params
  // PurchaseOrder.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getPurchaseOrderDetails(storeId, id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }
  const order = response.data
  // Received, closed and cancelled orders are finished
  if (!isEditablePurchaseOrder(order.status)) redirect(`/store/purchase-orders/${id}/details`)

  const [suppliers, rate] = await Promise.all([getSupplierOptions(storeId, order.supplier.id), getLatestExchangeRate()])
  if (!suppliers.success) throw new Error(suppliers.error)

  return <PurchaseOrderForm storeId={storeId} suppliers={suppliers.data} rate={rate && !rate.isStale ? rate.rate : null} order={order} />
}
