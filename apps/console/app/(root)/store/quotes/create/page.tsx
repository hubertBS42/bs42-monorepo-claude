import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { getStringParam } from "@workspace/utils/search-params"
import NewQuotation from "@/components/quotes/new-quotation"
import { requireActiveStoreMember } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "New Quotation",
}

type CreateStoreQuotePageProps = {
  // ?from= a quotation to copy
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function CreateStoreQuotePage({ searchParams }: CreateStoreQuotePageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["create"] }).success) redirect("/forbidden")

  const canChooseDiscount = organizationRoles[role].authorize({ order: ["update"] }).success
  return <NewQuotation storeId={storeId} from={getStringParam((await searchParams).from)} canChooseDiscount={canChooseDiscount} />
}
