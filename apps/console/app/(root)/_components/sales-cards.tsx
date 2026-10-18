import { Card, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ghs } from "@/components/orders/order-details"
import type { DashboardSales } from "@/types"

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardHeader>
    </Card>
  )
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

export default function SalesCards({ sales }: { sales: DashboardSales }) {
  return (
    <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Stat label="Net sales" value={ghs(sales.netSalesGhs)} note="Payments recorded, less refunds given" />
      <Stat label="Paid orders" value={String(sales.paidOrders)} note="Orders with their payment recorded" />
      <Stat label="Average order" value={sales.averageOrderGhs ? ghs(sales.averageOrderGhs) : "—"} note="Per paid order, before refunds" />
      <Stat label="Refunds" value={ghs(sales.refundedGhs)} note={`${plural(sales.refunds, "refund")}, ${plural(sales.returns, "return")}`} />
    </div>
  )
}
