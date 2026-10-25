// Fills in past days' USD→GHS rates from Open Exchange Rates' historical rates, so the dashboard's rate history has
// something to show before the daily fetch (the console's /api/cron/exchange-rate) has run for long. Only days with no
// rate are added: a rate set by hand, or one orders or quotes have used, is never touched. Each day is saved as the
// daily fetch would save it: the market rate, and as `rate` that plus Settings' markup today.
// Run with `pnpm --filter @workspace/db db:backfill-rates [days]` (default 90, the dashboard's longest period); it
// reads OPEN_EXCHANGE_RATES_API_KEY from apps/console/.env, and makes one request per missing day.
import { prisma } from "../src/client"
import { Prisma } from "../generated/prisma/client"
import { ExchangeRateSource } from "../generated/prisma/enums"
import { readAppSettings } from "../src/index"

const days = Number(process.argv[2] ?? 90)
if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error("Give the number of days to fill in, from 1 to 366.")

const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY?.trim()
if (!apiKey) throw new Error("OPEN_EXCHANGE_RATES_API_KEY is not set.")

// Days are UTC, which is Accra's time (getRateDate in @workspace/commerce/exchange-rates). Today is left to the daily fetch.
const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
const wanted = Array.from({ length: days }, (_, index) => new Date(today.getTime() - (days - index) * 86_400_000))

const existing = await prisma.exchangeRate.findMany({ where: { from: "USD", to: "GHS", date: { gte: wanted[0], lt: today } }, select: { date: true } })
const taken = new Set(existing.map((row) => row.date.getTime()))
const missing = wanted.filter((date) => !taken.has(date.getTime()))

const { exchangeRateMarkupPercent } = await readAppSettings()
const markup = new Prisma.Decimal(exchangeRateMarkupPercent).dividedBy(100).plus(1)

const dayKey = (date: Date) => date.toISOString().slice(0, 10)

async function historicalRate(date: Date): Promise<Prisma.Decimal> {
  const day = dayKey(date)
  // The key goes in a header, as in the daily fetch, so it stays out of request logs
  const response = await fetch(`https://openexchangerates.org/api/historical/${day}.json?symbols=GHS`, {
    headers: { Authorization: `Token ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  })
  const body = (await response.json().catch(() => null)) as { base?: string; rates?: { GHS?: number }; description?: string } | null
  if (!response.ok) throw new Error(`Open Exchange Rates answered ${response.status} for ${day}${body?.description ? `: ${body.description}` : ""}`)
  if (body?.base !== "USD" || typeof body.rates?.GHS !== "number" || body.rates.GHS <= 0) throw new Error(`No USD→GHS rate for ${day}.`)
  return new Prisma.Decimal(body.rates.GHS).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP)
}

console.log(`${existing.length} of the last ${days} days already have a rate; fetching ${missing.length}.`)

const rows: Prisma.ExchangeRateCreateManyInput[] = []
for (const date of missing) {
  const marketRate = await historicalRate(date)
  const rate = marketRate.times(markup).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP)
  rows.push({ from: "USD", to: "GHS", date, rate, marketRate, source: ExchangeRateSource.OPEN_EXCHANGE_RATES })
}

// skipDuplicates: a day saved meanwhile (by hand, or by the daily fetch) keeps its rate
const { count } = await prisma.exchangeRate.createMany({ data: rows, skipDuplicates: true })
console.log(`Saved ${count} rates${rows.length ? ` (${dayKey(rows[0]!.date as Date)} to ${dayKey(rows.at(-1)!.date as Date)})` : ""}.`)

await prisma.$disconnect()
