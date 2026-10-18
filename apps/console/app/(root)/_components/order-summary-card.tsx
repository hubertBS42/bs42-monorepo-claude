"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight, Copy } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { toast } from "@workspace/ui/components/toast"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-badges"
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-status"
import type { OrderSummary } from "./order-summary"

const ghs = (amount: string) => formatCurrency(amount, "GHS", "en-GH")

// A section's name, with its key fact so a closed section still says something
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-4 pr-2">
      <span className="font-semibold">{label}</span>
      <span className="truncate font-normal text-muted-foreground">{value}</span>
    </span>
  )
}

const units = (lines: OrderSummary["lines"]) => {
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)
  return `${count} item${count === 1 ? "" : "s"}`
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <li className={strong ? "flex items-center justify-between font-semibold" : "flex items-center justify-between"}>
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </li>
  )
}

interface OrderSummaryCardProps {
  order: OrderSummary
  position: number
  count: number
  onPrevious: () => void
  onNext: () => void
}

// After the order card in shadcn's old dashboard-05 block
export default function OrderSummaryCard({ order, position, count, onPrevious, onNext }: OrderSummaryCardProps) {
  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(order.reference)
      toast.add({ title: "Reference copied", description: order.reference, type: "success" })
    } catch {
      toast.add({ title: "Unable to copy the reference", type: "error" })
    }
  }

  const { totals, shipping } = order
  const discount = totals?.discountAmountGhs && Number(totals.discountAmountGhs) > 0 ? totals.discountAmountGhs : null

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-start bg-muted/50 py-6">
        <div className="grid min-w-0 gap-0.5">
          <CardTitle className="group flex items-center gap-2 text-lg">
            <span className="truncate font-mono">{order.reference}</span>
            <Button size="icon-xs" variant="outline" className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" onClick={copyReference}>
              <Copy />
              <span className="sr-only">Copy reference</span>
            </Button>
          </CardTitle>
          <CardDescription>{`Placed ${formatDate(order.createdAt, "LLLL d, yyyy, h:mm a")}`}</CardDescription>
          <div className="mt-2 flex flex-wrap gap-1">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        </div>
        <Link href={order.href} className={buttonVariants({ variant: "outline", size: "sm", className: "ml-auto" })}>
          View order
        </Link>
      </CardHeader>

      <CardContent className="py-2 text-sm">
        {/* Several can be open at once, and the same card stays mounted while paging, so open sections stay open */}
        <Accordion multiple defaultValue={["items"]}>
          <AccordionItem value="items">
            <AccordionTrigger>
              <Summary label="Order details" value={`${units(order.lines)} · ${ghs(totals?.totalGhs ?? order.totalGhs)}`} />
            </AccordionTrigger>
            <AccordionContent className="grid gap-3">
              <ul className="grid gap-3">
                {order.lines.map((line) => (
                  <li key={line.id} className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {line.productName}
                      {line.variantDescription && ` (${line.variantDescription})`} × <span>{line.quantity}</span>
                    </span>
                    <span>{ghs(line.totalPriceGhs)}</span>
                  </li>
                ))}
              </ul>
              <Separator className="my-1" />
              {totals ? (
                <ul className="grid gap-3">
                  <Row label="Subtotal">{ghs(totals.subtotalGhs)}</Row>
                  {discount && <Row label="Discount">{`−${ghs(discount)}`}</Row>}
                  <Row label="Shipping">{ghs(totals.shippingGhs)}</Row>
                  <Row label="Tax">{ghs(totals.taxGhs)}</Row>
                  <Row label="Total" strong>
                    {ghs(totals.totalGhs)}
                  </Row>
                </ul>
              ) : (
                <ul className="grid gap-3">
                  <Row label="This store's items" strong>
                    {ghs(order.totalGhs)}
                  </Row>
                  <li className="text-xs text-muted-foreground">After their share of the discount, with their tax. The rest of the order is other stores&apos;.</li>
                </ul>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="delivery">
            <AccordionTrigger>
              <Summary label="Delivery" value={shipping ? (shipping.town ?? shipping.region ?? "Delivery") : "Pickup"} />
            </AccordionTrigger>
            <AccordionContent>
              {shipping ? (
                <address className="grid gap-0.5 text-muted-foreground not-italic">
                  {[shipping.name, shipping.phone, shipping.line1, shipping.line2, shipping.town, shipping.region].filter(Boolean).map((part, index) => (
                    <span key={index}>{part}</span>
                  ))}
                </address>
              ) : (
                <p className="text-muted-foreground">The customer collects the order from the store.</p>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="customer">
            <AccordionTrigger>
              <Summary label="Customer" value={order.customer.name} />
            </AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-3">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate">
                    {order.customer.email ? <a href={`mailto:${order.customer.email}`}>{order.customer.email}</a> : <span className="text-muted-foreground">Not given</span>}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{order.customer.phone ? <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a> : <span className="text-muted-foreground">Not given</span>}</dd>
                </div>
              </dl>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payment">
            <AccordionTrigger>
              <Summary label="Payment" value={`${PAYMENT_STATUS_LABELS[order.paymentStatus]} · ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`} />
            </AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-3">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Method</dt>
                  <dd>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd>{order.paidAt ? formatDate(order.paidAt, "LLL d, yyyy, h:mm a") : <span className="text-muted-foreground">Not yet</span>}</dd>
                </div>
              </dl>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>

      <CardFooter className="flex flex-row items-center border-t bg-muted/50 px-6 py-3">
        <div className="text-xs text-muted-foreground">{`Order ${position + 1} of the ${count} most recent`}</div>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon-xs" variant="outline" onClick={onPrevious} disabled={position === 0}>
            <ChevronLeft />
            <span className="sr-only">Previous order</span>
          </Button>
          <Button size="icon-xs" variant="outline" onClick={onNext} disabled={position === count - 1}>
            <ChevronRight />
            <span className="sr-only">Next order</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
