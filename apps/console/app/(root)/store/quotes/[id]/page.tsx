import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import z from "zod"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import QuoteView from "@/components/quotes/quote-view"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getQuoteDetails } from "@/lib/data/quotes.data"

export const metadata: Metadata = {
  title: "Quotation",
}

type StoreQuotePageProps = {
  params: Promise<{ id: string }>
}

export default async function StoreQuotePage({ params }: StoreQuotePageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["read"] }).success) redirect("/forbidden")

  const { id } = await params
  // Quote.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getQuoteDetails(id, storeId)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  return <QuoteView quote={response.data} storeId={storeId} />
}
