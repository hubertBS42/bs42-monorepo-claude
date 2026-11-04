import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import ReportsHub from "@/components/reports/reports-hub"
import { requireActiveStoreMember } from "@/lib/auth-guard"

export const metadata: Metadata = { title: "Reports" }

// No tax report: tax is the platform's, as the seller of record
export default async function StoreReportsPage() {
  const { role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["read"] }).success) redirect("/forbidden")

  return (
    <ReportsHub
      description="This store's sales, profit, refunds and returns, stock and purchases."
      reports={[
        { report: "sales", href: "/store/reports/sales" },
        { report: "profit", href: "/store/reports/profit" },
        { report: "refunds", href: "/store/reports/refunds" },
        { report: "stock", href: "/store/reports/stock" },
        { report: "purchases", href: "/store/reports/purchases" },
      ]}
    />
  )
}
