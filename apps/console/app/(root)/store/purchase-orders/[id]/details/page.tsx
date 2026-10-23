import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import z from "zod"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import PurchaseOrderView from "@/components/purchase-orders/purchase-order-view"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getPurchaseOrderDetails } from "@/lib/data/purchase-orders.data"
import PurchaseOrderActions from "../../_components/purchase-order-actions"

export const metadata: Metadata = {
  title: "Purchase Order",
}

type PurchaseOrderDetailsPageProps = {
  params: Promise<{ id: string }>
}

export default async function PurchaseOrderDetailsPage({ params }: PurchaseOrderDetailsPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ purchaseOrder: ["read"] }).success) redirect("/forbidden")

  const { id } = await params
  // PurchaseOrder.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getPurchaseOrderDetails(storeId, id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  const order = response.data
  return (
    <PurchaseOrderView
      order={order}
      backTo="/store/purchase-orders"
      // Keyed by status and deliveries, so the dialogs start afresh after a change
      statusContent={<PurchaseOrderActions key={`${order.status}:${order.receipts.length}`} storeId={storeId} order={order} />}
    />
  )
}
