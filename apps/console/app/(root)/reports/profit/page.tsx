import type { Metadata } from "next"
import { prisma } from "@workspace/db"
import ProfitReportView from "@/components/reports/profit-report"
import { requireSystemPermission } from "@/lib/auth-guard"
import { readReportRange, todayKey } from "@/lib/report-range"
import { getProfitReport } from "@/lib/reports"

export const metadata: Metadata = { title: "Profit & Margins" }

type ProfitReportPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ProfitReportPage({ searchParams }: ProfitReportPageProps) {
  await requireSystemPermission({ order: ["read"] })
  const range = readReportRange(await searchParams)
  const report = await getProfitReport(prisma, null, range)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Profit & Margins</h1>
        <p className="text-sm text-muted-foreground">Every store&apos;s goods sold against what they cost.</p>
      </div>
      <ProfitReportView report={report} range={range} basePath="/reports/profit" today={todayKey()} filePrefix="bs42" />
    </div>
  )
}
