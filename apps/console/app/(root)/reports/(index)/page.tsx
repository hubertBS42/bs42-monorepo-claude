import type { Metadata } from "next"
import ReportsHub from "@/components/reports/reports-hub"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = { title: "Reports" }

export default async function ReportsPage() {
  await requireSystemPermission({ order: ["read"] })

  return (
    <ReportsHub
      description="Sales, profit, tax, refunds and returns, stock and purchases."
      reports={[
        { report: "sales", href: "/reports/sales" },
        { report: "profit", href: "/reports/profit" },
        { report: "tax", href: "/reports/tax" },
        { report: "refunds", href: "/reports/refunds" },
        { report: "stock", href: "/reports/stock" },
        { report: "purchases", href: "/reports/purchases" },
      ]}
    />
  )
}
