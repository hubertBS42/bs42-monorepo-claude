import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { prisma } from "@workspace/db"
import StockReportView from "@/components/reports/stock-report"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { todayKey } from "@/lib/report-range"
import { getStockValueReport } from "@/lib/reports"

export const metadata: Metadata = { title: "Stock Value Report" }

export default async function StoreStockValueReportPage() {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["read"] }).success) redirect("/forbidden")
  const [report, store] = await Promise.all([getStockValueReport(prisma, storeId), prisma.organization.findUnique({ where: { id: storeId }, select: { slug: true } })])

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Stock Value</h1>
        <p className="text-sm text-muted-foreground">This store&apos;s stock, at cost and at selling price.</p>
      </div>
      <StockReportView report={report} today={todayKey()} filePrefix={store?.slug ?? "store"} />
    </div>
  )
}
