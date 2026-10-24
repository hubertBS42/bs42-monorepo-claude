import type { Metadata } from "next"
import { readAppSettings } from "@workspace/db"
import { NotificationsCard } from "../_components/settings-cards"
import SettingsSection from "../_components/settings-section"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Notification Settings",
}

export default async function NotificationSettingsPage() {
  await requireSystemPermission({ appSettings: ["update"] })
  const settings = await readAppSettings()

  return (
    <SettingsSection title="Notifications" description="Staff email alerts and who receives them.">
      <NotificationsCard settings={settings} />
    </SettingsSection>
  )
}
