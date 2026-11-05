import Link from "next/link"
import { Truck } from "lucide-react"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { InfoTip } from "@workspace/ui/components/info-tip"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import { PurchaseOrderStatusBadge } from "@/components/order-badges"
import DownloadCsvButton from "@/components/reports/download-csv-button"
import ReportControls from "@/components/reports/report-controls"
import { ReportStat } from "@/components/reports/report-parts"
import { PURCHASE_ORDER_STATUS_LABELS } from "@/lib/purchase-order-status"
import type { ReportRange } from "@/lib/report-range"
import type { PurchasesReport } from "@/lib/reports"

interface PurchasesReportViewProps {
  report: PurchasesReport
  range: ReportRange
  basePath: string
  today: string
  // For the file names, as on the other reports
  filePrefix: string
  // The platform's report names each supplier's and order's store
  showStores: boolean
}

const usd = (amount: string) => formatCurrency(amount, "USD", "en-US")
const plural = (count: number, one: string, many: string) => `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`

function Linked({ href, children, mono = false }: { href: string | null; children: string; mono?: boolean }) {
  if (!href) return <>{children}</>
  return (
    <Link href={href} className={mono ? "font-mono text-xs underline-offset-4 hover:underline" : "underline-offset-4 hover:underline"}>
      {children}
    </Link>
  )
}

export default function PurchasesReportView({ report, range, basePath, today, filePrefix, showStores }: PurchasesReportViewProps) {
  const { summary, periods, suppliers, orders, products } = report
  const file = (name: string) => `${filePrefix}-${name}-${range.from}-to-${range.to}.csv`
  const periodName = range.by === "day" ? "Day" : "Month"

  return (
    <div className="grid gap-4">
      <ReportControls basePath={basePath} range={range} today={today} />

      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <ReportStat label="Ordered" value={usd(summary.orderedUsd)} note={plural(summary.ordersPlaced, "purchase order", "purchase orders")} />
        <ReportStat label="Shipping and import costs" value={usd(summary.shippingUsd)} note="Included in what was ordered" />
        <ReportStat label="Received" value={usd(summary.receivedUsd)} note={plural(summary.unitsReceived, "unit", "units")} />
        <ReportStat label="Deliveries" value={summary.deliveries.toLocaleString("en-US")} note="Received in this range" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            {range.by === "day" ? "By day" : "By month"}
            <InfoTip about="Purchases over time">
              Ordered counts purchase orders on the day they were marked as ordered, with their shipping and import costs, leaving out those cancelled since. Received counts deliveries on the day they
              arrived, at each line&apos;s invoiced cost. Everything is in US dollars: an order in cedis converts at the rate it was ordered at.
            </InfoTip>
          </CardTitle>
          <CardDescription>What was ordered from suppliers and what arrived, in US dollars.</CardDescription>
          <CardAction>
            <DownloadCsvButton
              filename={file("purchases")}
              headers={[periodName, "Orders placed", "Ordered (USD)", "Received (USD)"]}
              rows={periods.map((row) => [row.key, row.ordersPlaced, row.orderedUsd, row.receivedUsd])}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{periodName}</TableHead>
                <TableHead className="text-right">Orders placed</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((row) => (
                <TableRow key={row.key} className={row.ordersPlaced === 0 && Number(row.receivedUsd) === 0 ? "text-muted-foreground" : undefined}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.ordersPlaced}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(row.orderedUsd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(row.receivedUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{summary.ordersPlaced}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(summary.orderedUsd)}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(summary.receivedUsd)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>By supplier, each purchase order placed, and the products received.</CardDescription>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <EmptyState icon={Truck} title="No purchases" description="Nothing was ordered or received in this range." />
          ) : (
            <Tabs defaultValue="suppliers">
              <TabsList>
                <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                <TabsTrigger value="orders">{`Orders (${orders.length})`}</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
              </TabsList>

              <TabsContent value="suppliers" className="grid gap-2 pt-2">
                <div className="flex justify-end">
                  <DownloadCsvButton
                    filename={file("purchases-by-supplier")}
                    headers={["Supplier", ...(showStores ? ["Store"] : []), "Orders placed", "Units ordered", "Ordered (USD)", "Units received", "Received (USD)"]}
                    rows={suppliers.map((row) => [row.name, ...(showStores ? [row.store ?? ""] : []), row.ordersPlaced, row.unitsOrdered, row.orderedUsd, row.unitsReceived, row.receivedUsd])}
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      {showStores && <TableHead>Store</TableHead>}
                      <TableHead className="text-right">Orders placed</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="min-w-40 whitespace-normal">
                          <Linked href={row.href}>{row.name}</Linked>
                        </TableCell>
                        {showStores && <TableCell>{row.store}</TableCell>}
                        <TableCell className="text-right tabular-nums">{row.ordersPlaced}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <div className="grid">
                            <span>{usd(row.orderedUsd)}</span>
                            <span className="text-xs text-muted-foreground">{plural(row.unitsOrdered, "unit", "units")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <div className="grid">
                            <span>{usd(row.receivedUsd)}</span>
                            <span className="text-xs text-muted-foreground">{plural(row.unitsReceived, "unit", "units")}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="orders" className="grid gap-2 pt-2">
                <div className="flex justify-end">
                  <DownloadCsvButton
                    filename={file("purchase-orders")}
                    headers={["Ordered at", "Reference", "Supplier", ...(showStores ? ["Store"] : []), "Status", "Invoiced in", "Total (USD)"]}
                    rows={orders.map((row) => [
                      formatDate(row.orderedAt, "yyyy-MM-dd HH:mm"),
                      row.reference,
                      row.supplier,
                      ...(showStores ? [row.store ?? ""] : []),
                      PURCHASE_ORDER_STATUS_LABELS[row.status],
                      row.currency,
                      row.totalUsd,
                    ])}
                  />
                </div>
                {orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No purchase orders were placed in this range.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ordered</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Supplier</TableHead>
                        {showStores && <TableHead>Store</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{formatDate(row.orderedAt, "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <Linked href={row.href} mono>
                              {row.reference}
                            </Linked>
                          </TableCell>
                          <TableCell className="min-w-40 whitespace-normal">{row.supplier}</TableCell>
                          {showStores && <TableCell>{row.store}</TableCell>}
                          <TableCell>
                            <PurchaseOrderStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{usd(row.totalUsd)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="products" className="grid gap-2 pt-2">
                <div className="flex justify-end">
                  <DownloadCsvButton
                    filename={file("products-received")}
                    headers={["Product", "Units received", "Received (USD)"]}
                    rows={products.map((row) => [row.name, row.units, row.receivedUsd])}
                  />
                </div>
                {products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing was received in this range.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Units received</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="min-w-40 whitespace-normal">
                            <Linked href={row.href}>{row.name}</Linked>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.units}</TableCell>
                          <TableCell className="text-right tabular-nums">{usd(row.receivedUsd)}</TableCell>
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
