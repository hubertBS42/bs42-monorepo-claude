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
      {/* On the settings form's grid, as wide as its left column. Outside the form: the rate saves on its own, per day */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ExchangeRateCard latest={latestRate} maxAgeDays={EXCHANGE_RATE_MAX_AGE_DAYS} />
        </div>
      </div>
    </div>
  )
}
