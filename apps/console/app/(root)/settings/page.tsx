import type { Metadata } from "next"
import { readAppSettings } from "@workspace/db"
import { BrandingCard, ConsoleCard, StorefrontCard } from "./_components/settings-cards"
import SettingsSection from "./_components/settings-section"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function GeneralSettingsPage() {
  await requireSystemPermission({ appSettings: ["update"] })
  const settings = await readAppSettings()

  return (
    <SettingsSection title="General" description="Names and branding.">
      <StorefrontCard settings={settings} />
      <ConsoleCard settings={settings} />
      <BrandingCard settings={settings} />
    </SettingsSection>
  )
}
