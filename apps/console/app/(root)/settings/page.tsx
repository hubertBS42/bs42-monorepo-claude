import { Metadata } from "next"
import SettingsForm from "./_components/settings-form"
import ExchangeRateCard from "./_components/exchange-rate-card"
import DeliveryCard from "./_components/delivery-card"
import { requireSystemPermission } from "@/lib/auth-guard"
import { readAppSettings } from "@workspace/db"
import { getAppSettingsVersion } from "@/lib/data/app-settings.data"
import { getDeliverySettings } from "@/lib/data/delivery.data"
import { EXCHANGE_RATE_MAX_AGE_DAYS, getLatestExchangeRate } from "@workspace/commerce/exchange-rates"

export const metadata: Metadata = {
  title: "Platform Settings",
}

export default async function SettingsPage() {
  await requireSystemPermission({ appSettings: ["update"] })
  const [settings, version, latestRate, delivery] = await Promise.all([readAppSettings(), getAppSettingsVersion(), getLatestExchangeRate(), getDeliverySettings()])

  return (
    <div className="grid gap-6">
      <SettingsForm settings={settings} version={version} />
      {/* On the settings form's grid, as wide as its left column. Outside the form: the rate saves on its own, per day,
          and the delivery fees together */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <ExchangeRateCard latest={latestRate} maxAgeDays={EXCHANGE_RATE_MAX_AGE_DAYS} />
          <DeliveryCard settings={delivery} />
        </div>
      </div>
    </div>
  )
}
