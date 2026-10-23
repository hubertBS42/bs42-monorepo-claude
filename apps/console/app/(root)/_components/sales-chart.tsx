"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import { DASHBOARD_PERIODS, type DashboardPeriod, type DashboardSalesTrend } from "@/types"
import { PERIOD_LABELS, SHORT_PERIOD_LABELS } from "./periods"

const periodOptions = DASHBOARD_PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))

const chartConfig = {
  netSales: { label: "Net sales", color: "var(--primary)" },
} satisfies ChartConfig

// The days are plain yyyy-MM-dd in the app's zone, which is UTC+0, so they parse as that day's midnight
const dayLabel = (day: string) => formatDate(day, "LLL d")

// The period here sets the whole dashboard's, cards included, through the URL
export default function SalesChart({ days, period }: { days: DashboardSalesTrend["days"]; period: DashboardPeriod }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const setPeriod = (value: string | null | undefined) => {
    if (!value || value === period) return
    // 30 days is the default, so it gets the plain URL
    startTransition(() => router.push(value === "30d" ? "/" : `/?period=${value}`, { scroll: false }))
  }

  // Numbers only for drawing: the amounts were added up as decimals on the server
  const data = days.map((day) => ({ date: day.date, netSales: Number(day.netSalesGhs) }))

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Net sales</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">Payments less refunds, per day, for the {PERIOD_LABELS[period].toLowerCase()}</span>
          <span className="@[540px]/card:hidden">{PERIOD_LABELS[period]}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={[period]}
            onValueChange={(value) => setPeriod(value[0])}
            variant="outline"
            size="sm"
            // Joined, as in the block's Radix version; Base UI's group spaces its items apart by default
            spacing={0}
            disabled={isPending}
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[480px]/card:flex"
          >
            {DASHBOARD_PERIODS.map((value) => (
              <ToggleGroupItem key={value} value={value}>
                {SHORT_PERIOD_LABELS[value]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select items={periodOptions} value={period} onValueChange={setPeriod} disabled={isPending}>
            <SelectTrigger className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[480px]/card:hidden" size="sm" aria-label="Period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {DASHBOARD_PERIODS.map((value) => (
                <SelectItem key={value} value={value} className="rounded-lg">
                  {PERIOD_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className={cn("flex flex-1 flex-col px-2 pt-4 transition-opacity sm:px-6 sm:pt-6", isPending && "opacity-60")}>
        {/* Grows to match the card beside it, which the grid stretches both to */}
        <ChartContainer config={chartConfig} className="aspect-auto min-h-[250px] w-full flex-1">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillNetSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-netSales)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-netSales)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={dayLabel} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(_, payload) => dayLabel(String(payload[0]?.payload.date))}
                  formatter={(value) => (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">Net sales</span>
                      <span className="font-mono font-medium text-foreground tabular-nums">{formatCurrency(String(value), "GHS", "en-GH")}</span>
                    </div>
                  )}
                />
              }
            />
            <Area dataKey="netSales" type="monotone" fill="url(#fillNetSales)" stroke="var(--color-netSales)" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
