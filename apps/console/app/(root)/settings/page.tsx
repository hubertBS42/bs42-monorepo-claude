import { getAppSettings } from "@/lib/app-settings"
import { Metadata } from "next"
import SettingsForm from "./_components/settings-form"

export const metadata: Metadata = {
  title: "Platform settings",
}

export default async function SettingsPage() {
  const settings = await getAppSettings()

  return <SettingsForm settings={settings} />
}
