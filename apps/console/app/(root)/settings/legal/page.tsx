import type { Metadata } from "next"
import { authURLs } from "@workspace/auth/constants"
import LegalCard from "../_components/legal-card"
import SettingsSection from "../_components/settings-section"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getLegalPages } from "@/lib/data/legal.data"

export const metadata: Metadata = {
  title: "Legal Settings",
}

export default async function LegalSettingsPage() {
  await requireSystemPermission({ appSettings: ["update"] })
  const legal = await getLegalPages()

  return (
    <SettingsSection title="Legal" description="The storefront's Terms and Privacy pages.">
      <LegalCard pages={legal} storefrontUrl={authURLs.store} />
    </SettingsSection>
  )
}
