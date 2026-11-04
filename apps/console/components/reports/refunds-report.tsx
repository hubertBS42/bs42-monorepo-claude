import Link from "next/link"
import { Undo2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { InfoTip } from "@workspace/ui/components/info-tip"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { formatDate } from "@workspace/utils/date"
import DownloadCsvButton from "@/components/reports/download-csv-button"
import ReportControls from "@/components/reports/report-controls"
import { ghs, ReportStat } from "@/components/reports/report-parts"
import type { ReportRange } from "@/lib/report-range"
import type { RefundsReport } from "@/lib/reports"

interface RefundsReportViewProps {
  report: RefundsReport
  range: ReportRange
  basePath: string
  today: string
  // For the file names, as on the Sales report
  filePrefix: string
  // The platform's report names each order's stores
  showStores: boolean
}

const when = (date: Date) => formatDate(date, "MMM d, yyyy, h:mm a")
const csvWhen = (date: Date) => formatDate(date, "yyyy-MM-dd HH:mm")
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

function OrderLink({ href, reference }: { href: string; reference: string }) {
  return (
    <Link href={href} className="font-mono text-xs underline-offset-4 hover:underline">
      {reference}
    </Link>
  )
}

export default function RefundsReportView({ report, range, basePath, today, filePrefix, showStores }: RefundsReportViewProps) {
  const { summary, periods, refunds, returns, byProduct } = report
  const file = (name: string) => `${filePrefix}-${name}-${range.from}-to-${range.to}.csv`
  const periodName = range.by === "day" ? "Day" : "Month"
  const nothing = refunds.length === 0 && returns.length === 0

  return (
    <div className="grid gap-4">
      <ReportControls basePath={basePath} range={range} today={today} />

      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <ReportStat label="Refunded" value={ghs(summary.refundedGhs)} note={plural(summary.refunds, "refund", "refunds")} />
        <ReportStat label="Returns" value={String(summary.returns)} note={summary.returns === 1 ? "Return recorded" : "Returns recorded"} />
        <ReportStat label="Units returned" value={String(summary.unitsReturned)} note="Across every return" />
        <ReportStat label="Units restocked" value={String(summary.unitsRestocked)} note={`Of ${summary.unitsReturned} returned`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            {range.by === "day" ? "By day" : "By month"}
            <InfoTip about="Refunds and returns over time">
              Refunds count on the day they were given and returns on the day they were recorded, whenever the order was paid. A return&apos;s refund counts as a refund too.
            </InfoTip>
          </CardTitle>
          <CardDescription>Money given back and items brought back.</CardDescription>
          <CardAction>
            <DownloadCsvButton
              filename={file("refunds-and-returns")}
              headers={[periodName, "Refunds", "Refunded (GHS)", "Returns", "Units returned"]}
              rows={periods.map((row) => [row.key, row.refunds, row.refundedGhs, row.returns, row.unitsReturned])}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{periodName}</TableHead>
                <TableHead className="text-right">Refunds</TableHead>
                <TableHead className="text-right">Refunded</TableHead>
                <TableHead className="text-right">Returns</TableHead>
                <TableHead className="text-right">Units returned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((row) => (
                <TableRow key={row.key} className={row.refunds === 0 && row.returns === 0 ? "text-muted-foreground" : undefined}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.refunds}</TableCell>
                  <TableCell className="text-right tabular-nums">{ghs(row.refundedGhs)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.returns}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.unitsReturned}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{summary.refunds}</TableCell>
                <TableCell className="text-right tabular-nums">{ghs(summary.refundedGhs)}</TableCell>
                <TableCell className="text-right tabular-nums">{summary.returns}</TableCell>
                <TableCell className="text-right tabular-nums">{summary.unitsReturned}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Each refund and return, newest first, and the products brought back.</CardDescription>
        </CardHeader>
        <CardContent>
          {nothing ? (
            <EmptyState icon={Undo2} title="No refunds or returns" description="Nothing was refunded or brought back in this range." />
          ) : (
            <Tabs defaultValue="refunds">
              <TabsList>
                <TabsTrigger value="refunds">{`Refunds (${refunds.length})`}</TabsTrigger>
                <TabsTrigger value="returns">{`Returns (${returns.length})`}</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
              </TabsList>

              <TabsContent value="refunds" className="grid gap-2 pt-2">
                <div className="flex justify-end">
                  <DownloadCsvButton
                    filename={file("refunds")}
                    headers={["Refunded at", "Order", ...(showStores ? ["Stores"] : []), "Amount (GHS)", "Method", "With a return", "Reason", "By"]}
                    rows={refunds.map((row) => [
                      csvWhen(row.at),
                      row.reference,
                      ...(showStores ? [row.stores ?? ""] : []),
                      row.amountGhs,
                      row.method,
                      row.withReturn ? "Yes" : "No",
                      row.reason,
                      row.by ?? "",
                    ])}
                  />
                </div>
                {refunds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No refunds in this range.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Refunded</TableHead>
                        <TableHead>Order</TableHead>
                        {showStores && <TableHead>Stores</TableHead>}
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refunds.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{when(row.at)}</TableCell>
                          <TableCell>
                            <OrderLink href={row.href} reference={row.reference} />
                          </TableCell>
                          {showStores && <TableCell className="min-w-40 whitespace-normal">{row.stores}</TableCell>}
                          <TableCell className="text-right tabular-nums">{ghs(row.amountGhs)}</TableCell>
                          <TableCell>{row.method}</TableCell>
                          <TableCell className="min-w-40 whitespace-normal">
                            {row.withReturn && (
                              <Badge variant="outline" className="mr-1.5">
                                Return
                              </Badge>
                            )}
                            {row.reason}
                          </TableCell>
                          <TableCell>{row.by ?? <span className="text-muted-foreground">Unknown</span>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="returns" className="grid gap-2 pt-2">
                <div className="flex justify-end">
                  <DownloadCsvButton
                    filename={file("returns")}
                    headers={["Recorded at", "Order", ...(showStores ? ["Stores"] : []), "Units", "Restocked", "Refund (GHS)", "Reason", "By"]}
                    rows={returns.map((row) => [csvWhen(row.at), row.reference, ...(showStores ? [row.stores ?? ""] : []), row.units, row.restocked, row.refundGhs ?? "", row.reason, row.by ?? ""])}
                  />
                </div>
                {returns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No returns in this range.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recorded</TableHead>
                        <TableHead>Order</TableHead>
                        {showStores && <TableHead>Stores</TableHead>}
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right">Restocked</TableHead>
                        <TableHead className="text-right">Refund</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returns.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{when(row.at)}</TableCell>
                          <TableCell>
                            <OrderLink href={row.href} reference={row.reference} />
                          </TableCell>
                          {showStores && <TableCell className="min-w-40 whitespace-normal">{row.stores}</TableCell>}
                          <TableCell className="text-right tabular-nums">{row.units}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.restocked}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.refundGhs ? ghs(row.refundGhs) : <span className="text-muted-foreground">None</span>}</TableCell>
                          <TableCell className="min-w-40 whitespace-normal">{row.reason}</TableCell>
                          <TableCell>{row.by ?? <span className="text-muted-foreground">Unknown</span>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="products" className="grid gap-2 pt-2">
                <div className="flex justify-end">
                  <DownloadCsvButton filename={file("returned-products")} headers={["Product", "Units returned", "Restocked"]} rows={byProduct.map((row) => [row.name, row.units, row.restocked])} />
                </div>
                {byProduct.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing was brought back in this range.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Units returned</TableHead>
                        <TableHead className="text-right">Restocked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byProduct.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="min-w-40 whitespace-normal">
                            {row.href ? (
                              <Link href={row.href} className="underline-offset-4 hover:underline">
                                {row.name}
                              </Link>
                            ) : (
                              row.name
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.units}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.restocked}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
