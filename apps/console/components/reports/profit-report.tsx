import Link from "next/link"
import { TrendingUp } from "lucide-react"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { InfoTip } from "@workspace/ui/components/info-tip"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import CategoryPath from "@/components/category-path"
import DownloadCsvButton from "@/components/reports/download-csv-button"
import ReportControls from "@/components/reports/report-controls"
import { ghs, ReportStat } from "@/components/reports/report-parts"
import type { ReportRange } from "@/lib/report-range"
import type { ProfitReport, ProfitRow } from "@/lib/reports"

interface ProfitReportViewProps {
  report: ProfitReport
  range: ReportRange
  basePath: string
  today: string
  // For the file names, as on the other reports
  filePrefix: string
}

const percent = (margin: string | null) => (margin === null ? "-" : `${(Number(margin) * 100).toFixed(1)}%`)

// The cost, with how much of it is estimated
function CostCell({ costGhs, estimatedCostGhs }: { costGhs: string; estimatedCostGhs: string }) {
  return (
    <div className="grid">
      <span>{ghs(costGhs)}</span>
      {Number(estimatedCostGhs) > 0 && <span className="text-xs text-muted-foreground">{estimatedCostGhs === costGhs ? "Estimated" : `${ghs(estimatedCostGhs)} estimated`}</span>}
    </div>
  )
}

// The goods, with how much of them had no cost
function GoodsCell({ goodsGhs, uncostedGoodsGhs }: { goodsGhs: string; uncostedGoodsGhs: string }) {
  return (
    <div className="grid">
      <span>{ghs(goodsGhs)}</span>
      {Number(uncostedGoodsGhs) > 0 && <span className="text-xs text-muted-foreground">{`${ghs(uncostedGoodsGhs)} without a cost`}</span>}
    </div>
  )
}

const csvRow = (row: Omit<ProfitRow, "id" | "name" | "href" | "units">) => [
  row.goodsGhs,
  row.costedGoodsGhs,
  row.costGhs,
  row.estimatedCostGhs,
  row.profitGhs,
  row.margin === null ? "" : (Number(row.margin) * 100).toFixed(1),
]
const CSV_HEADERS = ["Goods (GHS)", "Goods with a cost (GHS)", "Cost (GHS)", "Estimated cost (GHS)", "Profit (GHS)", "Margin (%)"]

function ProfitTable({ rows, label, isCategory = false }: { rows: ProfitRow[]; label: string; isCategory?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{label}</TableHead>
          <TableHead className="text-right">Units</TableHead>
          <TableHead className="text-right">Goods</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="text-right">Profit</TableHead>
          <TableHead className="text-right">Margin</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="min-w-40 whitespace-normal">
              {isCategory ? (
                <CategoryPath path={row.name} />
              ) : row.href ? (
                <Link href={row.href} className="underline-offset-4 hover:underline">
                  {row.name}
                </Link>
              ) : (
                row.name
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.units}</TableCell>
            <TableCell className="text-right tabular-nums">
              <GoodsCell goodsGhs={row.goodsGhs} uncostedGoodsGhs={row.uncostedGoodsGhs} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <CostCell costGhs={row.costGhs} estimatedCostGhs={row.estimatedCostGhs} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.margin === null ? "-" : ghs(row.profitGhs)}</TableCell>
            <TableCell className="text-right tabular-nums">{percent(row.margin)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function ProfitReportView({ report, range, basePath, today, filePrefix }: ProfitReportViewProps) {
  const { summary, periods } = report
  const file = (name: string) => `${filePrefix}-${name}-${range.from}-to-${range.to}.csv`
  const periodName = range.by === "day" ? "Day" : "Month"
  const tabs = [
    { value: "product", title: "Products", label: "Product", rows: report.byProduct },
    { value: "category", title: "Categories", label: "Category", rows: report.byCategory },
    { value: "brand", title: "Brands", label: "Brand", rows: report.byBrand },
    ...(report.byStore ? [{ value: "store", title: "Stores", label: "Store", rows: report.byStore }] : []),
  ]
  const hasEstimates = Number(summary.estimatedCostGhs) > 0

  return (
    <div className="grid gap-4">
      <ReportControls basePath={basePath} range={range} today={today} />

      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <ReportStat
          label="Gross profit"
          value={summary.margin === null ? "-" : ghs(summary.profitGhs)}
          note={hasEstimates ? `${ghs(summary.estimatedProfitGhs)} of it on estimated costs` : "Goods less what they cost"}
        />
        <ReportStat label="Margin" value={percent(summary.margin)} note="Profit as a share of the goods" />
        <ReportStat label="Cost of goods" value={ghs(summary.costGhs)} note={hasEstimates ? `${ghs(summary.estimatedCostGhs)} estimated` : "At each sale's buy price"} />
        <ReportStat
          label="Without a cost"
          value={ghs(summary.uncostedGoodsGhs)}
          note={summary.uncostedLines ? `${summary.uncostedLines === 1 ? "1 line" : `${summary.uncostedLines} lines`} with no buy price, left out` : "Every line has a cost"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            {range.by === "day" ? "By day" : "By month"}
            <InfoTip about="Profit over time">
              Goods are items on orders paid in this range and not cancelled, after their discount and before tax, without delivery or installation, less units returned since. Each line costs its buy
              price when it was sold, at the order&apos;s exchange rate. The old site&apos;s orders didn&apos;t record one, so theirs is estimated from the buy price when they came across. Lines with
              no buy price count in the goods but not in profit or margin.
            </InfoTip>
          </CardTitle>
          <CardDescription>What goods sold for, what they cost, and the difference.</CardDescription>
          <CardAction>
            <DownloadCsvButton filename={file("profit")} headers={[periodName, ...CSV_HEADERS]} rows={periods.map((row) => [row.key, ...csvRow(row)])} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{periodName}</TableHead>
                <TableHead className="text-right">Goods</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((row) => (
                <TableRow key={row.key} className={Number(row.goodsGhs) === 0 ? "text-muted-foreground" : undefined}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <GoodsCell goodsGhs={row.goodsGhs} uncostedGoodsGhs={row.uncostedGoodsGhs} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <CostCell costGhs={row.costGhs} estimatedCostGhs={row.estimatedCostGhs} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.margin === null ? "-" : ghs(row.profitGhs)}</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(row.margin)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{ghs(summary.goodsGhs)}</TableCell>
                <TableCell className="text-right tabular-nums">{ghs(summary.costGhs)}</TableCell>
                <TableCell className="text-right tabular-nums">{summary.margin === null ? "-" : ghs(summary.profitGhs)}</TableCell>
                <TableCell className="text-right tabular-nums">{percent(summary.margin)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Profit by product, category, brand{report.byStore ? " and store" : ""}.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.byProduct.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No sales" description="Nothing was paid for in this range." />
          ) : (
            <Tabs defaultValue="product">
              <TabsList>
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.title}
                  </TabsTrigger>
                ))}
              </TabsList>
              {tabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="grid gap-2 pt-2">
                  <div className="flex justify-end">
                    <DownloadCsvButton filename={file(`profit-by-${tab.value}`)} headers={[tab.label, "Units", ...CSV_HEADERS]} rows={tab.rows.map((row) => [row.name, row.units, ...csvRow(row)])} />
                  </div>
                  <ProfitTable rows={tab.rows} label={tab.label} isCategory={tab.value === "category"} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
