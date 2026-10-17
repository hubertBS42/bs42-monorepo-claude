import "server-only"

import { prisma } from "@workspace/db"
import { formatDate } from "@workspace/utils/date"

// Orders refuse a rate older than this, so prices never go out at a rate nobody has checked in days
export const EXCHANGE_RATE_MAX_AGE_DAYS = 2

export interface ExchangeRateInfo {
  id: string
  // Units of GHS per 1 USD, as a string: Decimal can't be passed to client components
  rate: string
  // The day it applies to (yyyy-MM-dd)
  date: string
  isStale: boolean
}

// Today in the app's time zone, as stored in ExchangeRate.date
export function getRateDate(now = new Date()) {
  return formatDate(now, "yyyy-MM-dd")
}

// The most recent USD→GHS rate. Until a daily fetch job exists, a superAdmin sets it in Settings.
export async function getLatestExchangeRate(): Promise<ExchangeRateInfo | null> {
  const latest = await prisma.exchangeRate.findFirst({
    where: { from: "USD", to: "GHS" },
    orderBy: { date: "desc" },
    select: { id: true, rate: true, date: true },
  })
  if (!latest) return null

  // A @db.Date comes back as midnight UTC
  const date = latest.date.toISOString().slice(0, 10)
  const oldestUsable = new Date(`${getRateDate()}T00:00:00Z`)
  oldestUsable.setUTCDate(oldestUsable.getUTCDate() - EXCHANGE_RATE_MAX_AGE_DAYS)

  return { id: latest.id, rate: latest.rate.toString(), date, isStale: latest.date < oldestUsable }
}
