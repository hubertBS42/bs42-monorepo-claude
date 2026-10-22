import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { isOrderKey, orderHref } from "@workspace/commerce/order-links"
import { hasBeenPaid, PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { ShippingMethod } from "@workspace/db/enums"
import { formatDate } from "@workspace/utils/date"
import { getStringParam } from "@workspace/utils/search-params"

import { PrintButton } from "@/components/orders/print-button"
import type { SearchParams } from "@/lib/catalogue-filters"
import { formatGhs } from "@/lib/money"
import { getAppSettings, getStoreName } from "@/lib/settings"

export const metadata: Metadata = { title: "Invoice", robots: { index: false } }

type InvoicePageProps = {
  params: Promise<{ reference: string }>
  searchParams: Promise<SearchParams>
}

const money = (amount: Prisma.Decimal) => formatGhs(amount.toFixed(2))

function TotalRow({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-8 border-t pt-2 text-base font-semibold" : "flex justify-between gap-8"}>
      <span className={strong ? undefined : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{amount}</span>
    </div>
  )
}

// An order's invoice, laid out for printing or saving as PDF: what was sold, with the order's own amounts, and the
// company and TIN when a trade account placed it. Behind the order page's key, like the order page.
export default async function InvoicePage({ params, searchParams }: InvoicePageProps) {
  const [{ reference }, query] = await Promise.all([params, searchParams])
  const key = getStringParam(query.key)

  const order = await prisma.order.findUnique({
    where: { reference },
    select: {
      id: true,
      reference: true,
      createdAt: true,
      paymentStatus: true,
      paymentMethod: true,
      paidAt: true,
      shippingMethod: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      shippingLine1: true,
      shippingLine2: true,
      shippingTown: true,
      shippingRegion: true,
      tradeCompanyName: true,
      tradeTin: true,
      subtotalGhs: true,
      discountAmountGhs: true,
      discountReason: true,
      shippingGhs: true,
      installationGhs: true,
      taxRate: true,
      taxGhs: true,
      totalGhs: true,
      orderItems: {
        orderBy: { id: "asc" },
        select: { id: true, productName: true, variantDescription: true, sku: true, quantity: true, unitPriceGhs: true, totalPriceGhs: true, installationUnitGhs: true, installationTotalGhs: true },
      },
    },
  })
  // The same answer for a wrong key as for no order, so references can't be probed
  if (!order || !key || !isOrderKey(order.id, key)) notFound()

  const [settings, storeName] = await Promise.all([getAppSettings(), getStoreName()])
  const address = [order.shippingLine1, order.shippingLine2, order.shippingTown, order.shippingRegion].filter(Boolean).join(", ")
  const discount = order.discountAmountGhs?.gt(0) ? order.discountAmountGhs : null
  const paid = hasBeenPaid(order.paymentStatus)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={orderHref(order.reference, order.id)} className="text-sm text-muted-foreground hover:text-foreground">
          Back to the order
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-xl border bg-card p-6 text-sm md:p-10 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
              <img src={settings.logoUrl} alt={storeName} className="h-10 w-auto" />
            ) : (
              <p className="text-lg font-bold">{storeName}</p>
            )}
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold tracking-tight">Invoice</h1>
            <p className="font-mono">{order.reference}</p>
            <p className="text-muted-foreground">{formatDate(order.createdAt, "d MMMM yyyy")}</p>
          </div>
        </header>

        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="space-y-0.5">
            <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Bill to</h2>
            {order.tradeCompanyName && <p className="font-semibold">{order.tradeCompanyName}</p>}
            {order.tradeTin && <p>TIN {order.tradeTin}</p>}
            <p className={order.tradeCompanyName ? undefined : "font-semibold"}>{order.customerName}</p>
            {order.customerEmail && <p>{order.customerEmail}</p>}
            {order.customerPhone && <p>{order.customerPhone}</p>}
          </div>
          <div className="space-y-0.5">
            <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{order.shippingMethod === ShippingMethod.PICKUP ? "Collection" : "Deliver to"}</h2>
            <p>{order.shippingMethod === ShippingMethod.PICKUP ? "Collected from the store" : address}</p>
          </div>
        </section>

        <table className="mt-8 w-full">
          <thead>
            <tr className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit price</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.orderItems.map((item) => (
              <tr key={item.id} className="border-b align-top">
                <td className="py-3 pr-4">
                  <p className="font-medium">{item.productName}</p>
                  {item.variantDescription && <p className="text-muted-foreground">{item.variantDescription}</p>}
                  {item.sku && <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>}
                  {item.installationUnitGhs && (
                    <p className="text-muted-foreground">
                      Installation, {money(item.installationUnitGhs)} each: {money(item.installationTotalGhs)}
                    </p>
                  )}
                </td>
                <td className="py-3 text-right tabular-nums">{item.quantity}</td>
                <td className="py-3 text-right tabular-nums">{money(item.unitPriceGhs)}</td>
                <td className="py-3 text-right tabular-nums">{money(item.totalPriceGhs)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 ml-auto grid max-w-xs gap-1.5">
          <TotalRow label="Subtotal" amount={money(order.subtotalGhs)} />
          {discount && <TotalRow label={order.discountReason ?? "Discount"} amount={`−${money(discount)}`} />}
          {order.installationGhs.gt(0) && <TotalRow label="Installation" amount={money(order.installationGhs)} />}
          <TotalRow label="Delivery" amount={order.shippingGhs.isZero() ? "Free" : money(order.shippingGhs)} />
          {order.taxGhs.gt(0) && <TotalRow label={`Tax (${order.taxRate.times(100).toNumber()}%)`} amount={money(order.taxGhs)} />}
          <TotalRow label="Total" amount={money(order.totalGhs)} strong />
        </section>

        <footer className="mt-10 space-y-1 border-t pt-4 text-muted-foreground">
          <p>{paid && order.paidAt ? `Paid by ${PAYMENT_METHOD_LABELS[order.paymentMethod].toLowerCase()} on ${formatDate(order.paidAt, "d MMMM yyyy")}.` : "Not paid yet."}</p>
          <p>Amounts in Ghana cedis (GHS). Thank you for your order.</p>
        </footer>
      </article>
    </div>
  )
}
