import Link from "next/link"
import { ShoppingCart } from "lucide-react"
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
import type { GoodsRow, SalesReport } from "@/lib/reports"

interface SalesReportViewProps {
  report: SalesReport
  range: ReportRange
  basePath: string
  today: string
  // For the file names: "bs42-net-sales-2026-10-01-to-2026-10-31.csv"
  filePrefix: string
}

const share = (part: string, whole: string) => (Number(whole) ? `${((Number(part) / Number(whole)) * 100).toFixed(1)}%` : "-")

function GoodsTable({ rows, total, label, isCategory = false }: { rows: GoodsRow[]; total: string; label: string; isCategory?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{label}</TableHead>
          <TableHead className="text-right">Units</TableHead>
          <TableHead className="text-right">Goods</TableHead>
          <TableHead className="text-right">Share</TableHead>
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
            <TableCell className="text-right tabular-nums">{ghs(row.goodsGhs)}</TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">{share(row.goodsGhs, total)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function SalesReportView({ report, range, basePath, today, filePrefix }: SalesReportViewProps) {
  const { summary, periods, goods } = report
  const file = (name: string) => `${filePrefix}-${name}-${range.from}-to-${range.to}.csv`
  const goodsTabs = [
    { value: "product", title: "Products", label: "Product", rows: goods.byProduct },
    { value: "category", title: "Categories", label: "Category", rows: goods.byCategory },
    { value: "brand", title: "Brands", label: "Brand", rows: goods.byBrand },
    ...(goods.byStore ? [{ value: "store", title: "Stores", label: "Store", rows: goods.byStore }] : []),
  ]

  return (
    <div className="grid gap-4">
      <ReportControls basePath={basePath} range={range} today={today} />

      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <ReportStat label="Net sales" value={ghs(summary.netSalesGhs)} note="Payments less refunds" />
        <ReportStat label="Payments" value={ghs(summary.paymentsGhs)} note={summary.paidOrders === 1 ? "1 paid order" : `${summary.paidOrders} paid orders`} />
        <ReportStat label="Refunds" value={ghs(summary.refundsGhs)} note={summary.refunds === 1 ? "1 refund" : `${summary.refunds} refunds`} />
        <ReportStat label="Average order" value={summary.averageOrderGhs ? ghs(summary.averageOrderGhs) : "-"} note="Payments per paid order" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            {range.by === "day" ? "By day" : "By month"}
            <InfoTip about="Sales over time">
              Payments count on the day the order was paid, with its delivery, installation and tax. Refunds count on the day they were given, whenever the order was paid.
            </InfoTip>
          </CardTitle>
          <CardDescription>Payments, refunds and net sales.</CardDescription>
          <CardAction>
            <DownloadCsvButton
              filename={file("sales")}
              headers={[range.by === "day" ? "Day" : "Month", "Paid orders", "Payments (GHS)", "Refunds (GHS)", "Net sales (GHS)"]}
              rows={periods.map((row) => [row.key, row.paidOrders, row.paymentsGhs, row.refundsGhs, row.netSalesGhs])}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{range.by === "day" ? "Day" : "Month"}</TableHead>
                <TableHead className="text-right">Paid orders</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Refunds</TableHead>
                <TableHead className="text-right">Net sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((row) => (
                <TableRow key={row.key} className={row.paidOrders === 0 && Number(row.refundsGhs) === 0 ? "text-muted-foreground" : undefined}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.paidOrders}</TableCell>
                  <TableCell className="text-right tabular-nums">{ghs(row.paymentsGhs)}</TableCell>
                  <TableCell className="text-right tabular-nums">{ghs(row.refundsGhs)}</TableCell>
                  <TableCell className="text-right tabular-nums">{ghs(row.netSalesGhs)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{summary.paidOrders}</TableCell>
                <TableCell className="text-right tabular-nums">{ghs(summary.paymentsGhs)}</TableCell>
                <TableCell className="text-right tabular-nums">{ghs(summary.refundsGhs)}</TableCell>
                <TableCell className="text-right tabular-nums">{ghs(summary.netSalesGhs)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Goods sold
            <InfoTip about="Goods sold">
              Items on orders paid in this range and not cancelled, after their discount and before tax, without delivery or installation. Units returned since are taken off. Categories and brands are
              the catalogue&apos;s today.
            </InfoTip>
          </CardTitle>
          <CardDescription>{`${ghs(summary.goodsGhs)} across ${summary.units === 1 ? "1 unit" : `${summary.units} units`}.`}</CardDescription>
        </CardHeader>
        <CardContent>
          {goods.byProduct.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No sales" description="Nothing was paid for in this range." />
          ) : (
            <Tabs defaultValue="product">
              <TabsList>
                {goodsTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.title}
                  </TabsTrigger>
                ))}
              </TabsList>
              {goodsTabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="grid gap-2 pt-2">
                  <div className="flex justify-end">
                    <DownloadCsvButton filename={file(`goods-by-${tab.value}`)} headers={[tab.label, "Units", "Goods (GHS)"]} rows={tab.rows.map((row) => [row.name, row.units, row.goodsGhs])} />
                  </div>
                  <GoodsTable rows={tab.rows} total={summary.goodsGhs} label={tab.label} isCategory={tab.value === "category"} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
