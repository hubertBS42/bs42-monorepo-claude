import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { prisma } from "@workspace/db"
import PurchasesReportView from "@/components/reports/purchases-report"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { readReportRange, todayKey } from "@/lib/report-range"
import { getPurchasesReport } from "@/lib/reports"

export const metadata: Metadata = { title: "Purchases Report" }

type StorePurchasesReportPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function StorePurchasesReportPage({ searchParams }: StorePurchasesReportPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ purchaseOrder: ["read"] }).success) redirect("/forbidden")
  const range = readReportRange(await searchParams)
  const [report, store] = await Promise.all([getPurchasesReport(prisma, storeId, range), prisma.organization.findUnique({ where: { id: storeId }, select: { slug: true } })])

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Purchases</h1>
        <p className="text-sm text-muted-foreground">What this store ordered from its suppliers and received.</p>
      </div>
      <PurchasesReportView report={report} range={range} basePath="/store/reports/purchases" today={todayKey()} filePrefix={store?.slug ?? "store"} showStores={false} />
    </div>
  )
}
