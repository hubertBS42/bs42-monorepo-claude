import "server-only"

import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { ExchangeRateSource } from "@workspace/db/enums"
import { z } from "zod"
import { getRateDate } from "./data/exchange-rates.data"

// The daily USD→GHS rate from Open Exchange Rates (OPEN_EXCHANGE_RATES_API_KEY), run by POST /api/cron/exchange-rate.
// It only fills in a day that has no rate yet: a rate a superAdmin set in Settings is never overwritten, and neither
// is one that orders have used. In its own module (like store-order-writes.ts) so it can run without a request.

const API_URL = "https://openexchangerates.org/api/latest.json?symbols=GHS"
const REQUEST_TIMEOUT_MS = 15_000
// A move this large in a day is more likely a bad reading than the market, so it isn't saved; the last rate stays
// usable for EXCHANGE_RATE_MAX_AGE_DAYS, and a superAdmin can set one by hand meanwhile
const MAX_DAILY_CHANGE = new Prisma.Decimal("0.2")

// The free plan's base is always USD
const latestSchema = z.object({
  base: z.literal("USD"),
  rates: z.object({ GHS: z.number().positive() }),
})

export type RateFetchResult =
  | { status: "saved"; date: string; rate: string }
  // Today already has a rate, from an earlier run or set by hand
  | { status: "exists"; date: string; rate: string; source: ExchangeRateSource }
  | { status: "failed"; date: string; error: string }

async function requestRate(apiKey: string): Promise<Prisma.Decimal> {
  // The key goes in a header, not the URL, so it stays out of request logs
  const response = await fetch(API_URL, {
    headers: { Authorization: `Token ${apiKey}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    // Errors come back as { error: true, status, message, description }
    const description = z.object({ description: z.string() }).safeParse(body)
    throw new Error(`Open Exchange Rates answered ${response.status}${description.success ? `: ${description.data.description}` : ""}`)
  }

  const parsed = latestSchema.safeParse(body)
  if (!parsed.success) throw new Error("Open Exchange Rates sent a response without a USD→GHS rate.")
  // ExchangeRate.rate keeps six decimal places
  return new Prisma.Decimal(parsed.data.rates.GHS).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP)
}

export async function fetchTodaysRate(now = new Date()): Promise<RateFetchResult> {
  const day = getRateDate(now)
  const date = new Date(`${day}T00:00:00Z`)
  const key = { from_to_date: { from: "USD", to: "GHS", date } }

  try {
    const existing = await prisma.exchangeRate.findUnique({ where: key, select: { rate: true, source: true } })
    if (existing) return { status: "exists", date: day, rate: existing.rate.toString(), source: existing.source }

    const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY
    if (!apiKey) return { status: "failed", date: day, error: "OPEN_EXCHANGE_RATES_API_KEY is not set." }

    const rate = await requestRate(apiKey)

    const previous = await prisma.exchangeRate.findFirst({ where: { from: "USD", to: "GHS", date: { lt: date } }, orderBy: { date: "desc" }, select: { rate: true } })
    if (previous) {
      const change = rate.minus(previous.rate).abs().dividedBy(previous.rate)
      if (change.gt(MAX_DAILY_CHANGE)) {
        return {
          status: "failed",
          date: day,
          error: `The fetched rate (${rate}) is ${change.times(100).toFixed(1)}% away from the last one (${previous.rate}), so it wasn't saved. Check it and set today's rate in Settings.`,
        }
      }
    }

    try {
      await prisma.exchangeRate.create({ data: { from: "USD", to: "GHS", date, rate, source: ExchangeRateSource.OPEN_EXCHANGE_RATES } })
    } catch (error) {
      // Someone set today's rate (or another run saved it) while this one was fetching: theirs stands
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const saved = await prisma.exchangeRate.findUniqueOrThrow({ where: key, select: { rate: true, source: true } })
        return { status: "exists", date: day, rate: saved.rate.toString(), source: saved.source }
      }
      throw error
    }

    return { status: "saved", date: day, rate: rate.toString() }
  } catch (error) {
    return { status: "failed", date: day, error: error instanceof Error ? error.message : String(error) }
  }
}
