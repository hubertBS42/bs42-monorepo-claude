"use client"

import { ShoppingCart } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { buttonVariants } from "@workspace/ui/components/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrency } from "@workspace/utils/currency"
import { OrderStatusBadge } from "@/components/order-badges"
import type { OrderSummary } from "./order-summary"
import OrderSummaryCard from "./order-summary-card"
import { EmptyState } from "@workspace/ui/components/empty-state"

// The latest orders in a table, with the selected one summed up in a card beside it. Clicking a row, or the card's
// previous and next buttons, picks the order the card shows. The table only has what picking one needs; the card has
// the rest (payment, date, items, customer details).
export default function RecentOrders({ orders, listHref, description }: { orders: OrderSummary[]; listHref: string; description: string }) {
  const [selected, setSelected] = useState(0)
  const order = orders[selected]

  return (
    <div className="grid items-start gap-4 md:gap-6 @5xl/main:grid-cols-[3fr_2fr]">
      <section className="grid gap-3">
        <div className="flex items-end justify-between gap-4">
          <div className="grid">
            <h2 className="font-semibold">Recent orders</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Link href={listHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            View all
          </Link>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="whitespace-normal">
                    <EmptyState icon={ShoppingCart} title="No orders yet" description="The latest orders show here." />
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((row, index) => (
                  <TableRow key={row.id} data-state={index === selected ? "selected" : undefined} onClick={() => setSelected(index)} className="cursor-pointer">
                    <TableCell>
                      <Link href={row.href} className="font-mono underline-offset-4 hover:underline">
                        {row.reference}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="grid">
                        <span>{row.customer.name}</span>
                        {row.note && <span className="text-xs text-muted-foreground">{row.note}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.totalGhs, "GHS", "en-GH")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
      {order && (
        <OrderSummaryCard
          order={order}
          position={selected}
          count={orders.length}
          onPrevious={() => setSelected((index) => Math.max(index - 1, 0))}
          onNext={() => setSelected((index) => Math.min(index + 1, orders.length - 1))}
        />
      )}
    </div>
  )
}
