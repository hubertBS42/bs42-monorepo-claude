"use server"

import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import { ActionResponse, type DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { ExchangeRateSource } from "@workspace/db/enums"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getRateDate } from "@workspace/commerce/exchange-rates"
import { exchangeRateFormSchema } from "@/lib/schemas/exchange-rate.schemas"
import { fetchTodaysRate } from "@/lib/exchange-rate-fetch"

// Sets today's USD→GHS rate by hand: for a day the daily fetch failed, or to override the fetched rate.
// The fetch never overwrites a rate set here.
export async function setTodaysExchangeRateAction(input: z.input<typeof exchangeRateFormSchema>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ appSettings: ["update"] })

  try {
    const parsed = exchangeRateFormSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid rate", code: "INVALID" }

    const date = new Date(`${getRateDate()}T00:00:00Z`)
    const key = { from_to_date: { from: "USD", to: "GHS", date } }

    // Orders and quotes link to the rate row they used, so its rate can't change under them
    const existing = await prisma.exchangeRate.findUnique({ where: key, select: { rate: true, _count: { select: { orders: true, quotes: true } } } })
    if (existing && existing._count.orders + existing._count.quotes > 0 && !existing.rate.equals(parsed.data.rate)) {
      return { success: false, error: "Orders or quotes have already been priced at today's rate, so it can't change until tomorrow.", code: "RATE_IN_USE" }
    }

    await prisma.exchangeRate.upsert({
      where: key,
      create: { from: "USD", to: "GHS", date, rate: parsed.data.rate, source: ExchangeRateSource.MANUAL },
      // Typed by hand, so no market rate or markup
      update: { rate: parsed.data.rate, marketRate: null, source: ExchangeRateSource.MANUAL, fetchedAt: new Date() },
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Runs the daily fetch now (what POST /api/cron/exchange-rate does), for a day the scheduled run missed. It only fills in
// a day with no rate, and refuses the same suspicious readings; no failure email, since whoever pressed it sees why.
export async function fetchTodaysExchangeRateAction(): Promise<DataResponse<{ status: "saved" | "exists"; date: string; rate: string }>> {
  await requireSystemPermission({ appSettings: ["update"] })

  const result = await fetchTodaysRate()
  if (result.status === "failed") return { success: false, error: result.error, code: "FETCH_FAILED" }
  return { success: true, data: { status: result.status, date: result.date, rate: result.rate } }
}
