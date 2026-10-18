import Link from "next/link"
import { cn } from "@workspace/ui/lib/utils"
import type { DashboardPeriod } from "@/types"

const PERIOD_LABELS: Record<DashboardPeriod, string> = { today: "Today", "7d": "7 days", "30d": "30 days" }

export default function PeriodTabs({ period }: { period: DashboardPeriod }) {
  return (
    <nav aria-label="Sales period" className="flex gap-1 rounded-lg border p-1">
      {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((value) => (
        <Link
          key={value}
          href={value === "7d" ? "/" : `/?period=${value}`}
          aria-current={value === period ? "page" : undefined}
          className={cn("rounded-md px-3 py-1 text-sm", value === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}
        >
          {PERIOD_LABELS[value]}
        </Link>
      ))}
    </nav>
  )
}
