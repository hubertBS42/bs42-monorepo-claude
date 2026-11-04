import type { Metadata } from "next"
import { prisma } from "@workspace/db"
import PurchasesReportView from "@/components/reports/purchases-report"
import { requireConsoleAdmin } from "@/lib/auth-guard"
import { readReportRange, todayKey } from "@/lib/report-range"
import { getPurchasesReport } from "@/lib/reports"

export const metadata: Metadata = { title: "Purchases Report" }

type PurchasesReportPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// System admins, as the platform's purchase orders page
export default async function PurchasesReportPage({ searchParams }: PurchasesReportPageProps) {
  await requireConsoleAdmin()
  const range = readReportRange(await searchParams)
  const report = await getPurchasesReport(prisma, null, range)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Purchases</h1>
        <p className="text-sm text-muted-foreground">What every store ordered from its suppliers and received.</p>
      </div>
      <PurchasesReportView report={report} range={range} basePath="/reports/purchases" today={todayKey()} filePrefix="bs42" showStores />
    </div>
  )
}
