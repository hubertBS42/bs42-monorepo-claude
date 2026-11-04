import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { prisma } from "@workspace/db"
import ProfitReportView from "@/components/reports/profit-report"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { readReportRange, todayKey } from "@/lib/report-range"
import { getProfitReport } from "@/lib/reports"

export const metadata: Metadata = { title: "Profit & Margins" }

type StoreProfitReportPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// The store's own lines, as its sales report counts them
export default async function StoreProfitReportPage({ searchParams }: StoreProfitReportPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["read"] }).success) redirect("/forbidden")
  const range = readReportRange(await searchParams)
  const [report, store] = await Promise.all([getProfitReport(prisma, storeId, range), prisma.organization.findUnique({ where: { id: storeId }, select: { slug: true } })])

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Profit & Margins</h1>
        <p className="text-sm text-muted-foreground">This store&apos;s goods sold against what they cost.</p>
      </div>
      <ProfitReportView report={report} range={range} basePath="/store/reports/profit" today={todayKey()} filePrefix={store?.slug ?? "store"} />
    </div>
  )
}
