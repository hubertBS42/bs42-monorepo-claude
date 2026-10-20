import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getLatestExchangeRate } from "@workspace/commerce/exchange-rates"
import { getSupplierOptions } from "@/lib/data/purchase-orders.data"
import PurchaseOrderForm from "../_components/purchase-order-form"

export const metadata: Metadata = {
  title: "Create Purchase Order",
}

export default async function CreatePurchaseOrderPage() {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ purchaseOrder: ["create"] }).success) redirect("/forbidden")

  const [suppliers, rate] = await Promise.all([getSupplierOptions(storeId), getLatestExchangeRate()])
  if (!suppliers.success) throw new Error(suppliers.error)

  return <PurchaseOrderForm storeId={storeId} suppliers={suppliers.data} rate={rate && !rate.isStale ? rate.rate : null} order={null} />
}
