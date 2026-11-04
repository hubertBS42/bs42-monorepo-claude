import type { Metadata } from "next"
import { prisma } from "@workspace/db"
import RefundsReportView from "@/components/reports/refunds-report"
import { requireSystemPermission } from "@/lib/auth-guard"
import { readReportRange, todayKey } from "@/lib/report-range"
import { getRefundsReport } from "@/lib/reports"

export const metadata: Metadata = { title: "Refunds & Returns Report" }

type RefundsReportPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function RefundsReportPage({ searchParams }: RefundsReportPageProps) {
  await requireSystemPermission({ order: ["read"] })
  const range = readReportRange(await searchParams)
  const report = await getRefundsReport(prisma, null, range)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Refunds &amp; Returns</h1>
        <p className="text-sm text-muted-foreground">Every store&apos;s refunds and returns.</p>
      </div>
      <RefundsReportView report={report} range={range} basePath="/reports/refunds" today={todayKey()} filePrefix="bs42" showStores />
    </div>
  )
}
