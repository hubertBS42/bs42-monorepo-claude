import type { Metadata } from "next"
import { prisma } from "@workspace/db"
import TaxReportView from "@/components/reports/tax-report"
import { getAppSettings } from "@/lib/app-settings"
import { requireSystemPermission } from "@/lib/auth-guard"
import { readReportRange, todayKey } from "@/lib/report-range"
import { getTaxReport } from "@/lib/reports"

export const metadata: Metadata = { title: "Tax Report" }

type TaxReportPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function TaxReportPage({ searchParams }: TaxReportPageProps) {
  await requireSystemPermission({ order: ["read"] })
  const range = readReportRange(await searchParams)
  const [report, settings] = await Promise.all([getTaxReport(prisma, range), getAppSettings()])

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Tax</h1>
        <p className="text-sm text-muted-foreground">Tax the platform charged on paid orders, less refunds.</p>
      </div>
      <TaxReportView report={report} range={range} basePath="/reports/tax" today={todayKey()} taxEnabled={settings.taxEnabled} />
    </div>
  )
}
