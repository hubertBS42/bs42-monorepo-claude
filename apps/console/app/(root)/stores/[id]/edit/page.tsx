import { Metadata } from "next"
import EditStoreForm from "./_components/edit-store-form"
import PickupLocationCard from "@/components/pickup-location-card"
import { getPickupSuppliers, getStorePickupLocation } from "@/lib/data/pickup-locations.data"
import PickupSuppliersCard from "@/components/pickup-suppliers-card"
import { getBranchGroupsForStore } from "@/lib/data/branch-groups.data"
import BranchGroupCard from "@/components/branch-group-card"
import { getStoreById } from "@/lib/data/stores.data"
import { notFound } from "next/navigation"
import { requireOrganizationPermission, requireSystemPermission } from "@/lib/auth-guard"
import z from "zod"

export const metadata: Metadata = {
  title: "Edit Store",
}

type Props = {
  params: Promise<{ id: string }>
}
export default async function EditStorePage({ params }: Props) {
  // System admins only, and only for stores they are a member of with update rights
  await requireSystemPermission({ organization: ["update"] })
  const { id } = await params
  // Member.organizationId is a UUID column, so the membership check below needs a valid one
  if (!z.uuid().safeParse(id).success) notFound()
  await requireOrganizationPermission(id, { organization: ["update"] })
  const [response, pickupLocation, branchGroups, suppliers] = await Promise.all([getStoreById(id), getStorePickupLocation(id), getBranchGroupsForStore(id), getPickupSuppliers(id)])

  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  return (
    <EditStoreForm
      store={response.data}
      pickupLocationCard={
        <>
          <PickupLocationCard storeId={id} location={pickupLocation} />
          {suppliers && <PickupSuppliersCard storeId={id} groupName={suppliers.groupName} branches={suppliers.branches} />}
        </>
      }
      branchGroupCard={<BranchGroupCard storeId={id} current={branchGroups.current} groups={branchGroups.groups} />}
    />
  )
}
