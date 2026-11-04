import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { InfoTip } from "@workspace/ui/components/info-tip"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import DownloadCsvButton from "@/components/reports/download-csv-button"
import ReportControls from "@/components/reports/report-controls"
import { ghs, ReportStat } from "@/components/reports/report-parts"
import type { ReportRange } from "@/lib/report-range"
import type { TaxReport } from "@/lib/reports"

interface TaxReportViewProps {
  report: TaxReport
  range: ReportRange
  basePath: string
  today: string
  // Settings' tax switch now, for a note when it's off
  taxEnabled: boolean
}

const percent = (fraction: string) => `${(Number(fraction) * 100).toFixed(2).replace(/\.?0+$/, "")}%`

const PERIOD_COLUMNS = ["Paid orders", "Sales before tax", "Tax on goods", "Tax on delivery", "Tax on installation", "Tax charged", "Tax refunded", "Net tax"] as const

export default function TaxReportView({ report, range, basePath, today, taxEnabled }: TaxReportViewProps) {
  const { summary, periods, byRate } = report
  const file = (name: string) => `${name}-${range.from}-to-${range.to}.csv`
  const periodName = range.by === "day" ? "Day" : "Month"

  return (
    <div className="grid gap-4">
      <ReportControls basePath={basePath} range={range} today={today} />
      {!taxEnabled && <p className="text-sm text-muted-foreground">Tax is turned off in Settings, so orders placed now charge none.</p>}

      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <ReportStat label="Tax charged" value={ghs(summary.taxGhs)} note={summary.paidOrders === 1 ? "On 1 paid order" : `On ${summary.paidOrders} paid orders`} />
        <ReportStat label="Tax refunded" value={ghs(summary.refundedTaxGhs)} note={summary.refunds === 1 ? "In 1 refund" : `In ${summary.refunds} refunds`} />
        <ReportStat label="Net tax" value={ghs(summary.netTaxGhs)} note="Charged less refunded" />
        <ReportStat label="Sales before tax" value={ghs(summary.salesExTaxGhs)} note="Paid orders' totals without tax" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            {range.by === "day" ? "By day" : "By month"}
            <InfoTip about="Tax over time">
              Tax counts when the order was paid. A refund gives back the order&apos;s share of tax in what was refunded (a refund of half the order gives back half its tax), counted when the refund
              was given.
            </InfoTip>
          </CardTitle>
          <CardDescription>Tax charged on paid orders, less tax refunded.</CardDescription>
          <CardAction>
            <DownloadCsvButton
              filename={file("tax")}
              headers={[periodName, ...PERIOD_COLUMNS.map((column) => (column === "Paid orders" ? column : `${column} (GHS)`))]}
              rows={periods.map((row) => [row.key, row.paidOrders, row.salesExTaxGhs, row.goodsTaxGhs, row.deliveryTaxGhs, row.installationTaxGhs, row.taxGhs, row.refundedTaxGhs, row.netTaxGhs])}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{periodName}</TableHead>
                {PERIOD_COLUMNS.map((column) => (
                  <TableHead key={column} className="text-right">
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((row) => (
                <TableRow key={row.key} className={row.paidOrders === 0 && Number(row.refundedTaxGhs) === 0 ? "text-muted-foreground" : undefined}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.paidOrders}</TableCell>
                  {[row.salesExTaxGhs, row.goodsTaxGhs, row.deliveryTaxGhs, row.installationTaxGhs, row.taxGhs, row.refundedTaxGhs, row.netTaxGhs].map((amount, index) => (
                    <TableCell key={index} className="text-right tabular-nums">
                      {ghs(amount)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{summary.paidOrders}</TableCell>
                {[summary.salesExTaxGhs, summary.goodsTaxGhs, summary.deliveryTaxGhs, summary.installationTaxGhs, summary.taxGhs, summary.refundedTaxGhs, summary.netTaxGhs].map((amount, index) => (
                  <TableCell key={index} className="text-right tabular-nums">
                    {ghs(amount)}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            By rate
            <InfoTip about="Tax by rate">Each order keeps the tax rate it was placed at, so a change of rate in Settings shows here as two rows. Orders placed with tax off are at 0%.</InfoTip>
          </CardTitle>
          <CardDescription>Paid orders by the tax rate they were charged.</CardDescription>
          <CardAction>
            <DownloadCsvButton
              filename={file("tax-by-rate")}
              headers={["Rate (%)", "Paid orders", "Sales before tax (GHS)", "Tax charged (GHS)"]}
              rows={byRate.map((row) => [(Number(row.rate) * 100).toFixed(2), row.paidOrders, row.salesExTaxGhs, row.taxGhs])}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          {byRate.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paid orders in this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rate</TableHead>
                  <TableHead className="text-right">Paid orders</TableHead>
                  <TableHead className="text-right">Sales before tax</TableHead>
                  <TableHead className="text-right">Tax charged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byRate.map((row) => (
                  <TableRow key={row.rate}>
                    <TableCell>{percent(row.rate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.paidOrders}</TableCell>
                    <TableCell className="text-right tabular-nums">{ghs(row.salesExTaxGhs)}</TableCell>
                    <TableCell className="text-right tabular-nums">{ghs(row.taxGhs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
