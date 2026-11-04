import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { prisma } from "@workspace/db"
import SalesReportView from "@/components/reports/sales-report"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { readReportRange, todayKey } from "@/lib/report-range"
import { getSalesReport } from "@/lib/reports"

export const metadata: Metadata = { title: "Sales Report" }

type StoreReportsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// The store's sales, as its dashboard counts them; tax is the platform's (it's the seller of record), so it has no tax report
export default async function StoreReportsPage({ searchParams }: StoreReportsPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["read"] }).success) redirect("/forbidden")
  const range = readReportRange(await searchParams)
  const [report, store] = await Promise.all([getSalesReport(prisma, storeId, range), prisma.organization.findUnique({ where: { id: storeId }, select: { slug: true } })])

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Sales Report</h1>
        <p className="text-sm text-muted-foreground">This store&apos;s payments, refunds and goods sold.</p>
      </div>
      <SalesReportView report={report} range={range} basePath="/store/reports" today={todayKey()} filePrefix={store?.slug ?? "store"} />
    </div>
  )
}
