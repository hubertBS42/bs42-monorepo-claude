import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { prisma } from "@workspace/db"
import RefundsReportView from "@/components/reports/refunds-report"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { readReportRange, todayKey } from "@/lib/report-range"
import { getRefundsReport } from "@/lib/reports"

export const metadata: Metadata = { title: "Refunds & Returns Report" }

type StoreRefundsReportPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Refunds and returns on orders made only of the store's items: those on shared orders are the platform's
export default async function StoreRefundsReportPage({ searchParams }: StoreRefundsReportPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["read"] }).success) redirect("/forbidden")
  const range = readReportRange(await searchParams)
  const [report, store] = await Promise.all([getRefundsReport(prisma, storeId, range), prisma.organization.findUnique({ where: { id: storeId }, select: { slug: true } })])

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Refunds &amp; Returns</h1>
        <p className="text-sm text-muted-foreground">Refunds and returns on this store&apos;s own orders.</p>
      </div>
      <RefundsReportView report={report} range={range} basePath="/store/reports/refunds" today={todayKey()} filePrefix={store?.slug ?? "store"} showStores={false} />
    </div>
  )
}
