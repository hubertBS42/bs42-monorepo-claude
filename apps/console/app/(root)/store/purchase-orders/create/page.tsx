import type { Metadata } from "next"
import { redirect } from "next/navigation"
import z from "zod"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { getStringParam } from "@workspace/utils/search-params"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getLatestExchangeRate } from "@workspace/commerce/exchange-rates"
import { findPurchasableListings, getSupplierOptions, MAX_PURCHASABLE_LISTINGS } from "@/lib/data/purchase-orders.data"
import { suggestPurchaseLines } from "@/lib/purchase-order-status"
import PurchaseOrderForm from "../_components/purchase-order-form"

export const metadata: Metadata = {
  title: "Create Purchase Order",
}

type CreatePurchaseOrderPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function CreatePurchaseOrderPage({ searchParams }: CreatePurchaseOrderPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ purchaseOrder: ["create"] }).success) redirect("/forbidden")

  // ?listings= comes from the listings table's selection ("Create purchase order"): the form starts with their rows.
  // Ids that aren't uuids are dropped (Prisma would throw on them), and the store's own are found among the rest.
  const listingIds = (getStringParam((await searchParams).listings) ?? "")
    .split(",")
    .filter((id) => z.uuid().safeParse(id).success)
    .slice(0, MAX_PURCHASABLE_LISTINGS)

  const [suppliers, rate, picked] = await Promise.all([
    getSupplierOptions(storeId),
    getLatestExchangeRate(),
    listingIds.length ? findPurchasableListings(storeId, { listingIds }) : Promise.resolve([]),
  ])
  if (!suppliers.success) throw new Error(suppliers.error)

  return <PurchaseOrderForm storeId={storeId} suppliers={suppliers.data} rate={rate && !rate.isStale ? rate.rate : null} order={null} suggested={suggestPurchaseLines(picked)} />
}
