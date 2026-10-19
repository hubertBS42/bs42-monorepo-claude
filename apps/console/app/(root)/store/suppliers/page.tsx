import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import StoreAddButton from "@/components/store-add-button"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getSuppliers, MAX_SUPPLIERS_PAGE_SIZE, SUPPLIER_SORT_FIELDS } from "@/lib/data/suppliers.data"
import type { SuppliersParams } from "@/types"
import SuppliersTable from "./_components/suppliers-table"

export const metadata: Metadata = {
  title: "Suppliers",
}

type SuppliersPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ purchaseOrder: ["read"] }).success) redirect("/forbidden")
  const params = await searchParams

  const archived = getEnumParam(params.archived, ["true", "false"])
  const suppliersParams: SuppliersParams = {
    name: getStringParam(params.name),
    archived: archived === undefined ? undefined : archived === "true",
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_SUPPLIERS_PAGE_SIZE),
    sort: getSortParam(params.sort, SUPPLIER_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const result = await getSuppliers(storeId, suppliersParams)
  if (!result.success) throw new Error(result.error)

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Who this store buys its stock from.</p>
        </div>

        <StoreAddButton storeId={storeId} label="Add Supplier" url="/store/suppliers/add" permission={{ supplier: ["create"] }} deniedText="Your role in this store can't add suppliers." />
      </div>
      <SuppliersTable data={result.data} storeId={storeId} />
    </main>
  )
}
