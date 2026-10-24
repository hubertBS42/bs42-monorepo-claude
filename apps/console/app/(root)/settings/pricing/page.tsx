import type { Metadata } from "next"
import { EXCHANGE_RATE_MAX_AGE_DAYS, getLatestExchangeRate } from "@workspace/commerce/exchange-rates"
import { readAppSettings } from "@workspace/db"
import ExchangeRateCard from "../_components/exchange-rate-card"
import { BankTransferCard, MarkupCard, QuotationsCard, TaxCard } from "../_components/settings-cards"
import SettingsSection from "../_components/settings-section"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Pricing Settings",
}

export default async function PricingSettingsPage() {
  await requireSystemPermission({ appSettings: ["update"] })
  const [settings, latestRate] = await Promise.all([readAppSettings(), getLatestExchangeRate()])

  return (
    <SettingsSection title="Pricing" description="Exchange rate, tax, quotations and bank transfers.">
      <ExchangeRateCard latest={latestRate} maxAgeDays={EXCHANGE_RATE_MAX_AGE_DAYS} />
      <MarkupCard settings={settings} />
      <TaxCard settings={settings} />
      <QuotationsCard settings={settings} />
      <BankTransferCard settings={settings} />
    </SettingsSection>
  )
}
