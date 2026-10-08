import { Metadata } from "next"
import SettingsForm from "./_components/settings-form"
import { requireSystemPermission } from "@/lib/auth-guard"
import { readAppSettings } from "@workspace/db"

export const metadata: Metadata = {
  title: "Platform settings",
}

export default async function SettingsPage() {
  await requireSystemPermission({ appSettings: ["update"] })
  const settings = await readAppSettings()

  return <SettingsForm settings={settings} />
}
