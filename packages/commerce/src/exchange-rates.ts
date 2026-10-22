import "server-only"

import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import type { ExchangeRateSource } from "@workspace/db/enums"
import { formatDate } from "@workspace/utils/date"

// Orders refuse a rate older than this, so prices never go out at a rate nobody has checked in days
export const EXCHANGE_RATE_MAX_AGE_DAYS = 2

export interface ExchangeRateInfo {
  id: string
  // Units of GHS per 1 USD, as a string: Decimal can't be passed to client components
  rate: string
  // The market rate fetched, before Settings' markup; null for a rate set by hand
  marketRate: string | null
  // The day it applies to (yyyy-MM-dd)
  date: string
  // Fetched daily, or set by hand in Settings
  source: ExchangeRateSource
  isStale: boolean
}

// Today in the app's time zone, as stored in ExchangeRate.date
export function getRateDate(now = new Date()) {
  return formatDate(now, "yyyy-MM-dd")
}

// The most recent USD→GHS rate: fetched daily (lib/exchange-rate-fetch.ts), or set by a superAdmin in Settings
export async function getLatestExchangeRate(): Promise<ExchangeRateInfo | null> {
  const latest = await prisma.exchangeRate.findFirst({
    where: { from: "USD", to: "GHS" },
    orderBy: { date: "desc" },
    select: { id: true, rate: true, marketRate: true, date: true, source: true },
  })
  if (!latest) return null

  // A @db.Date comes back as midnight UTC
  const date = latest.date.toISOString().slice(0, 10)
  const oldestUsable = new Date(`${getRateDate()}T00:00:00Z`)
  oldestUsable.setUTCDate(oldestUsable.getUTCDate() - EXCHANGE_RATE_MAX_AGE_DAYS)

  return { id: latest.id, rate: latest.rate.toString(), marketRate: latest.marketRate?.toString() ?? null, date, source: latest.source, isStale: latest.date < oldestUsable }
}

export interface PricingContext {
  rate: ExchangeRateInfo
  // Null when tax is off
  tax: { rate: Prisma.Decimal; onShipping: boolean } | null
}

// The rate and tax settings an order is priced with, or null when there's no rate recent enough to sell at
export async function getPricingContext(): Promise<PricingContext | null> {
  const [rate, settings] = await Promise.all([getLatestExchangeRate(), prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { taxEnabled: true, taxRate: true, taxShipping: true } })])
  if (!rate || rate.isStale) return null
  return {
    rate,
    // Read as a Decimal here: AppSettingsData.taxRate is a plain number only so it can reach client components
    tax: settings?.taxEnabled ? { rate: settings.taxRate, onShipping: settings.taxShipping } : null,
  }
}
