import type { Metadata } from "next"
import ReportsHub from "@/components/reports/reports-hub"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = { title: "Reports" }

export default async function ReportsPage() {
  await requireSystemPermission({ order: ["read"] })

  return (
    <ReportsHub
      description="Sales, tax, refunds and returns, and the value of stock."
      reports={[
        { report: "sales", href: "/reports/sales" },
        { report: "tax", href: "/reports/tax" },
        { report: "refunds", href: "/reports/refunds" },
        { report: "stock", href: "/reports/stock" },
      ]}
    />
  )
}
