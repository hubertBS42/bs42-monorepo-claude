import Link from "next/link"
import { Package } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { InfoTip } from "@workspace/ui/components/info-tip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import CategoryPath from "@/components/category-path"
import DownloadCsvButton from "@/components/reports/download-csv-button"
import { ghs, ReportStat } from "@/components/reports/report-parts"
import type { StockGroupRow, StockValueReport } from "@/lib/reports"

interface StockReportViewProps {
  report: StockValueReport
  today: string
  // For the file names, as on the other reports
  filePrefix: string
}

const usd = (amount: string) => formatCurrency(amount, "USD", "en-US")
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

function GroupTable({ rows, label, isCategory = false }: { rows: StockGroupRow[]; label: string; isCategory?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{label}</TableHead>
          <TableHead className="text-right">Units</TableHead>
          <TableHead className="text-right">At cost</TableHead>
          <TableHead className="text-right">At selling price</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="min-w-40 whitespace-normal">{isCategory ? <CategoryPath path={row.name} /> : row.name}</TableCell>
            <TableCell className="text-right tabular-nums">{row.units}</TableCell>
            <TableCell className="text-right tabular-nums">
              <div className="grid">
                <span>{usd(row.costUsd)}</span>
                {row.unitsWithoutCost > 0 && <span className="text-xs text-muted-foreground">{`${row.unitsWithoutCost} without a buy price`}</span>}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{usd(row.retailUsd)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function StockReportView({ report, today, filePrefix }: StockReportViewProps) {
  const { summary, rate, items } = report
  const file = (name: string) => `${filePrefix}-${name}-${today}.csv`
  const groupHeaders = (label: string) => [label, "Units", "At cost (USD)", "At selling price (USD)", "Units without a buy price"]
  const groupRows = (rows: StockGroupRow[]) => rows.map((row) => [row.name, row.units, row.costUsd, row.retailUsd, row.unitsWithoutCost])
  const groups = [
    { value: "category", title: "Categories", label: "Category", rows: report.byCategory },
    { value: "brand", title: "Brands", label: "Brand", rows: report.byBrand },
    ...(report.byStore ? [{ value: "store", title: "Stores", label: "Store", rows: report.byStore }] : []),
  ]
  const inGhs = (amount: string | null) => (amount && rate ? `${ghs(amount)} at GH₵${rate.rate} per $1` : "No exchange rate yet")

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <ReportStat label="At cost" value={usd(summary.costUsd)} note={inGhs(summary.costGhs)} />
        <ReportStat label="At selling price" value={usd(summary.retailUsd)} note={inGhs(summary.retailGhs)} />
        <ReportStat label="Units in stock" value={summary.units.toLocaleString("en-US")} note={`Across ${plural(summary.items, "item", "items")}`} />
        <ReportStat
          label="Without a buy price"
          value={String(summary.itemsWithoutCost)}
          note={summary.itemsWithoutCost ? `${plural(summary.unitsWithoutCost, "unit", "units")} left out of the cost` : "Every item has one"}
        />
      </div>
      {summary.itemsWithoutCost > 0 && (
        <p className="text-sm text-muted-foreground">
          {`${plural(summary.itemsWithoutCost, "item has", "items have")} no buy price, so the cost leaves out ${plural(summary.unitsWithoutCost, "unit", "units")}. Set it on the listing, or receive a purchase order that updates it.`}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Stock on hand
            <InfoTip about="Stock on hand">
              Each listing that tracks stock and has some, and each such variant, valued at its buy price (or the listing&apos;s, for a variant without one) and at its selling price before tax. Prices
              are kept in US dollars; the cedi figures use the latest exchange rate.
            </InfoTip>
          </CardTitle>
          <CardDescription>{rate ? `What's in stock now, in cedis at the rate of ${formatDate(rate.date, "MMM d, yyyy")}.` : "What's in stock now."}</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon={Package} title="No stock" description="No listing that tracks stock has any." />
          ) : (
            <Tabs defaultValue="items">
              <TabsList>
                <TabsTrigger value="items">Items</TabsTrigger>
                {groups.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.title}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="items" className="grid gap-2 pt-2">
                <div className="flex justify-end">
                  <DownloadCsvButton
                    filename={file("stock")}
                    headers={["Product", "Variant", ...(report.byStore ? ["Store"] : []), "Units", "Buy price (USD)", "At cost (USD)", "At selling price (USD)"]}
                    rows={items.map((row) => [row.name, row.variant ?? "", ...(report.byStore ? [row.store ?? ""] : []), row.units, row.unitCostUsd ?? "", row.costUsd ?? "", row.retailUsd])}
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      {report.byStore && <TableHead>Store</TableHead>}
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Buy price</TableHead>
                      <TableHead className="text-right">At cost</TableHead>
                      <TableHead className="text-right">At selling price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="min-w-40 whitespace-normal">
                          <div className="grid">
                            <Link href={row.href} className="w-fit underline-offset-4 hover:underline">
                              {row.name}
                            </Link>
                            {row.variant && <span className="text-xs text-muted-foreground">{row.variant}</span>}
                          </div>
                        </TableCell>
                        {report.byStore && <TableCell>{row.store}</TableCell>}
                        <TableCell className="text-right tabular-nums">{row.units}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.unitCostUsd ? usd(row.unitCostUsd) : <span className="text-muted-foreground">Not set</span>}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.costUsd ? usd(row.costUsd) : <span className="text-muted-foreground">-</span>}</TableCell>
                        <TableCell className="text-right tabular-nums">{usd(row.retailUsd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              {groups.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="grid gap-2 pt-2">
                  <div className="flex justify-end">
                    <DownloadCsvButton filename={file(`stock-by-${tab.value}`)} headers={groupHeaders(tab.label)} rows={groupRows(tab.rows)} />
                  </div>
                  <GroupTable rows={tab.rows} label={tab.label} isCategory={tab.value === "category"} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
