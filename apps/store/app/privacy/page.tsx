import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { LegalPageView } from "@/components/legal-page"
import { getLegalPages } from "@/lib/settings"

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } }

export default async function PrivacyPage() {
  const { privacy } = await getLegalPages()
  if (!privacy) notFound()
  return <LegalPageView title="Privacy Policy" page={privacy} />
}
