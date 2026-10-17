import { Metadata } from "next"
import SettingsForm from "./_components/settings-form"
import ExchangeRateCard from "./_components/exchange-rate-card"
import { requireSystemPermission } from "@/lib/auth-guard"
import { readAppSettings } from "@workspace/db"
import { getAppSettingsVersion } from "@/lib/data/app-settings.data"
import { EXCHANGE_RATE_MAX_AGE_DAYS, getLatestExchangeRate } from "@/lib/data/exchange-rates.data"

export const metadata: Metadata = {
  title: "Platform Settings",
}

export default async function SettingsPage() {
  await requireSystemPermission({ appSettings: ["update"] })
  const [settings, version, latestRate] = await Promise.all([readAppSettings(), getAppSettingsVersion(), getLatestExchangeRate()])

  return (
    <div className="grid gap-6">
      <SettingsForm settings={settings} version={version} />
      <ExchangeRateCard latest={latestRate} maxAgeDays={EXCHANGE_RATE_MAX_AGE_DAYS} />
    </div>
  )
}
