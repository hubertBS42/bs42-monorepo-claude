import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { LegalPageView } from "@/components/legal-page"
import { getLegalPages } from "@/lib/settings"

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } }

export default async function TermsPage() {
  const { terms } = await getLegalPages()
  if (!terms) notFound()
  return <LegalPageView title="Terms" page={terms} />
}
