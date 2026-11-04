import type { Metadata } from "next"
import { prisma } from "@workspace/db"
import SalesReportView from "@/components/reports/sales-report"
import { requireSystemPermission } from "@/lib/auth-guard"
import { readReportRange, todayKey } from "@/lib/report-range"
import { getSalesReport } from "@/lib/reports"

export const metadata: Metadata = { title: "Sales Report" }

type SalesReportPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SalesReportPage({ searchParams }: SalesReportPageProps) {
  await requireSystemPermission({ order: ["read"] })
  const range = readReportRange(await searchParams)
  const report = await getSalesReport(prisma, null, range)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Sales</h1>
        <p className="text-sm text-muted-foreground">Every store&apos;s payments, refunds and goods sold.</p>
      </div>
      <SalesReportView report={report} range={range} basePath="/reports/sales" today={todayKey()} filePrefix="bs42" />
    </div>
  )
}
