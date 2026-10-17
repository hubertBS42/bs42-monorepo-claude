import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import z from "zod"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getListingFormData } from "@/lib/data/listings.data"
import ListingForm from "../../_components/listing-form"

export const metadata: Metadata = {
  title: "Edit Listing",
}

type EditListingPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditListingPage({ params }: EditListingPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ listing: ["update"] }).success) redirect("/forbidden")

  const { id } = await params
  // StoreListing.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getListingFormData(storeId, id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  const canDelete = organizationRoles[role].authorize({ listing: ["delete"] }).success

  return <ListingForm storeId={storeId} data={response.data} canDelete={canDelete} />
}
