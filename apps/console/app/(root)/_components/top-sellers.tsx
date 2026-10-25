"use client"

import { TrendingUp } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { formatCurrency } from "@workspace/utils/currency"
import type { DashboardPeriod, DashboardTopSellers } from "@/types"
import { PERIOD_LABELS } from "./periods"
import { EmptyState } from "@workspace/ui/components/empty-state"

type Ranking = keyof DashboardTopSellers

const RANKINGS: { value: Ranking; label: string }[] = [
  { value: "byRevenue", label: "Revenue" },
  { value: "byUnits", label: "Units" },
]

// The period's best sellers, ranked by revenue or by units sold. Both lists come from the server, since the top five
// by one needn't be the top five by the other.
export default function TopSellers({ sellers, period, description }: { sellers: DashboardTopSellers; period: DashboardPeriod; description: string }) {
  const [ranking, setRanking] = useState<Ranking>("byRevenue")
  const rows = sellers[ranking]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Best sellers</CardTitle>
        <CardDescription>{`${description}, ${PERIOD_LABELS[period].toLowerCase()}, less returns. Revenue excludes tax and delivery.`}</CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={[ranking]}
            onValueChange={(value) => {
              if (value[0]) setRanking(value[0] as Ranking)
            }}
            variant="outline"
            spacing={0}
            size="sm"
            aria-label="Rank by"
          >
            {RANKINGS.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="whitespace-normal">
                    <EmptyState icon={TrendingUp} title="Nothing sold in this period" description="Products on paid orders show here." />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="size-8 shrink-0 overflow-hidden rounded bg-muted">{row.image && <img alt="" src={row.image} className="size-full object-cover" />}</div>
                        {row.href ? (
                          <Link href={row.href} className="truncate font-medium hover:underline">
                            {row.name}
                          </Link>
                        ) : (
                          <span className="truncate font-medium">{row.name}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.units}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.revenueGhs, "GHS", "en-GH")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
