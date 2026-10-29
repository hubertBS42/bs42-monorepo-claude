import { TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ghs } from "@/components/orders/order-details"
import type { DashboardPeriod, DashboardSalesTrend } from "@/types"
import { PREVIOUS_PERIODS } from "./periods"

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

function TrendBadge({ change }: { change: number | null }) {
  if (change === null) return null
  const Icon = change < 0 ? TrendingDown : TrendingUp
  return (
    <Badge variant="outline">
      <Icon />
      {change > 0 ? "+" : ""}
      {change}%
    </Badge>
  )
}

interface StatCardProps {
  label: string
  value: string
  change: number | null
  period: DashboardPeriod
  note: string
  // Replaces the comparison line, for a card whose change isn't the point
  headline?: string
}

function StatCard({ label, value, change, period, note, headline }: StatCardProps) {
  const previous = PREVIOUS_PERIODS[period]
  const comparison = change === null ? `Nothing to compare with in ${previous}` : change === 0 ? `Level with ${previous}` : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)}% on ${previous}`
  const Icon = change !== null && change < 0 ? TrendingDown : TrendingUp

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        <CardAction>
          <TrendBadge change={change} />
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {headline ?? comparison}
          {!headline && change !== null && change !== 0 && <Icon className="size-4" />}
        </div>
        <div className="text-muted-foreground">{note}</div>
      </CardFooter>
    </Card>
  )
}

export default function SectionCards({ sales, period }: { sales: DashboardSalesTrend; period: DashboardPeriod }) {
  const { current, changes } = sales
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <StatCard label="Net sales" value={ghs(current.netSalesGhs)} change={changes.netSales} period={period} note="Payments recorded, less refunds given" />
      <StatCard label="Paid orders" value={String(current.paidOrders)} change={changes.paidOrders} period={period} note="Orders with their payment recorded" />
      <StatCard label="Average order" value={current.averageOrderGhs ? ghs(current.averageOrderGhs) : "—"} change={changes.averageOrder} period={period} note="Per paid order, before refunds" />
      <StatCard
        label="Refunds"
        value={ghs(current.refundedGhs)}
        change={changes.refunded}
        period={period}
        headline={`${plural(current.refunds, "refund")}, ${plural(current.returns, "return")}`}
        note="Given back, with or without a return"
      />
    </div>
  )
}
