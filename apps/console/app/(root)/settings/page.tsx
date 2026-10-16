import { Metadata } from "next"
import SettingsForm from "./_components/settings-form"
import { requireSystemPermission } from "@/lib/auth-guard"
import { readAppSettings } from "@workspace/db"
import { getAppSettingsVersion } from "@/lib/data/app-settings.data"

export const metadata: Metadata = {
  title: "Platform Settings",
}

export default async function SettingsPage() {
  await requireSystemPermission({ appSettings: ["update"] })
  const [settings, version] = await Promise.all([readAppSettings(), getAppSettingsVersion()])

  return <SettingsForm settings={settings} version={version} />
}
