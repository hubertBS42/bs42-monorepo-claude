"use client"

import { ChartLine, TrendingDown, TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/chart"
import { InfoTip } from "@workspace/ui/components/info-tip"
import { formatDate } from "@workspace/utils/date"
import type { DashboardExchangeRates, DashboardPeriod } from "@/types"
import { PERIOD_LABELS } from "./periods"
import { EmptyState } from "@workspace/ui/components/empty-state"

const chartConfig = {
  rate: { label: "Rate used", color: "var(--primary)" },
  marketRate: { label: "Market rate", color: "var(--muted-foreground)" },
} satisfies ChartConfig

// The days are plain yyyy-MM-dd in the app's zone, which is UTC+0, so they parse as that day's midnight
const dayLabel = (day: string) => formatDate(day, "LLL d")

const cedis = (value: number) => `GH₵${value.toFixed(4)}`

// The USD→GHS rate per day for the dashboard's period, with the market rate beside it when a markup made them differ.
// Days a superAdmin set the rate by hand get a dot.
export default function ExchangeRateChart({ rates, period }: { rates: DashboardExchangeRates; period: DashboardPeriod }) {
  // Numbers only for drawing: the rates stay decimals on the server
  const data = rates.days.map((day) => ({
    date: day.date,
    rate: day.rate === null ? null : Number(day.rate),
    marketRate: day.marketRate === null ? null : Number(day.marketRate),
    setByHand: day.setByHand,
  }))
  const values = data.flatMap((day) => [day.rate, day.marketRate]).filter((value): value is number => value !== null)
  const showMarket = rates.days.some((day) => day.marketRate !== null && day.marketRate !== day.rate)
  const latest = data.filter((day) => day.rate !== null).at(-1)

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Exchange rate
          <InfoTip about="Exchange rate">The USD to GHS rate prices used each day, fetched daily or set in Settings. A dot marks a day it was set by hand; the change is over the period.</InfoTip>
        </CardTitle>
        <CardDescription>{latest ? `${cedis(latest.rate!)} per $1 on ${dayLabel(latest.date)}` : `No rate in the ${PERIOD_LABELS[period].toLowerCase()}`}</CardDescription>
        {rates.change !== null && (
          <CardAction>
            <Badge variant="outline">
              {rates.change < 0 ? <TrendingDown /> : <TrendingUp />}
              {rates.change > 0 ? "+" : ""}
              {rates.change}%
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-2 pt-4 sm:px-6 sm:pt-6">
        {values.length < 2 ? (
          <EmptyState icon={ChartLine} title="Not enough history yet" description="The chart starts once there are two days of rates." className="min-h-[250px]" />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto min-h-[250px] w-full flex-1">
            <LineChart data={data} margin={{ left: 4, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={dayLabel} />
              {/* The rate moves a few percent at most, so the axis fits the values rather than starting at 0 */}
              <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} tickMargin={4} width={44} tickFormatter={(value: number) => value.toFixed(2)} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(_, payload) => {
                      const day = payload[0]?.payload as (typeof data)[number] | undefined
                      return day ? `${dayLabel(day.date)}${day.setByHand ? ", set by hand" : ""}` : ""
                    }}
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig].label}</span>
                        <span className="font-mono font-medium text-foreground tabular-nums">{cedis(Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
              {showMarket && <Line dataKey="marketRate" type="linear" stroke="var(--color-marketRate)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls />}
              <Line
                dataKey="rate"
                type="linear"
                stroke="var(--color-rate)"
                strokeWidth={2}
                connectNulls
                dot={({ cx, cy, payload, index }) =>
                  payload.setByHand && cx !== undefined && cy !== undefined ? <circle key={index} cx={cx} cy={cy} r={3} fill="var(--color-rate)" /> : <g key={index} />
                }
              />
              {showMarket && <ChartLegend content={<ChartLegendContent />} />}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
