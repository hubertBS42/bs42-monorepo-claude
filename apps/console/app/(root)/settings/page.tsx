import { Metadata } from "next"
import SettingsForm from "./_components/settings-form"
import ExchangeRateCard from "./_components/exchange-rate-card"
import DeliveryCard from "./_components/delivery-card"
import LegalCard from "./_components/legal-card"
import { requireSystemPermission } from "@/lib/auth-guard"
import { readAppSettings } from "@workspace/db"
import { getAppSettingsVersion } from "@/lib/data/app-settings.data"
import { getDeliverySettings } from "@/lib/data/delivery.data"
import { getLegalPages } from "@/lib/data/legal.data"
import { authURLs } from "@workspace/auth/constants"
import { EXCHANGE_RATE_MAX_AGE_DAYS, getLatestExchangeRate } from "@workspace/commerce/exchange-rates"

export const metadata: Metadata = {
  title: "Platform Settings",
}

export default async function SettingsPage() {
  await requireSystemPermission({ appSettings: ["update"] })
  const [settings, version, latestRate, delivery, legal] = await Promise.all([readAppSettings(), getAppSettingsVersion(), getLatestExchangeRate(), getDeliverySettings(), getLegalPages()])

  return (
    <div className="grid gap-6">
      <SettingsForm settings={settings} version={version} />
      {/* On the settings form's grid, as wide as its left column. Outside the form: each card saves on its own (the rate per
          day, the delivery fees together, the legal pages together) */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <ExchangeRateCard latest={latestRate} maxAgeDays={EXCHANGE_RATE_MAX_AGE_DAYS} />
          <DeliveryCard settings={delivery} />
          <LegalCard pages={legal} storefrontUrl={authURLs.store} />
        </div>
      </div>
    </div>
  )
}
