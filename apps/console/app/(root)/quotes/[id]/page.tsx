import type { Metadata } from "next"
import { notFound } from "next/navigation"
import z from "zod"
import QuoteView from "@/components/quotes/quote-view"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getQuoteDetails } from "@/lib/data/quotes.data"

export const metadata: Metadata = {
  title: "Quotation",
}

type QuotePageProps = {
  params: Promise<{ id: string }>
}

export default async function QuotePage({ params }: QuotePageProps) {
  await requireSystemPermission({ order: ["read"] })

  const { id } = await params
  // Quote.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getQuoteDetails(id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  return <QuoteView quote={response.data} storeId={null} />
}
