import type { Metadata } from "next"
import { notFound } from "next/navigation"
import z from "zod"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatDate } from "@workspace/utils/date"
import { formatPhoneNumber } from "@workspace/utils/phone"
import BackButton from "@/components/back-button"
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-badges"
import CollectionCard from "@/components/orders/collection-card"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getCollectionDetails } from "@/lib/data/collections.data"
import { STATE_LABELS } from "../states"
import HandOver from "./_components/hand-over"

export const metadata: Metadata = {
  title: "Collection",
}

// One order to hand over at this branch: what's on it, items still coming, and handing it over. Every role.
export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { storeId } = await requireActiveStoreMember()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const result = await getCollectionDetails(storeId, id)
  if (!result.success) {
    if (result.code === "NOT_FOUND") notFound()
    throw new Error(result.error)
  }
  const order = result.data

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-mono text-xl font-bold md:text-2xl">{order.reference}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {`Placed ${formatDate(order.createdAt, "MMM d, yyyy, h:mm a")}`}
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            <Badge variant="outline">{STATE_LABELS[order.state]}</Badge>
          </div>
        </div>
        <BackButton link="/store/collections" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>To hand over</CardTitle>
            <CardDescription>Everything on the order, from any branch.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="min-w-40 whitespace-normal">
                      <div className="grid">
                        <span>{line.label}</span>
                        <span className="text-xs text-muted-foreground">{[line.sku, line.storeName && `From ${line.storeName}`].filter(Boolean).join(" · ")}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {order.notes && <p className="mt-4 text-sm text-muted-foreground">{`Notes: ${order.notes}`}</p>}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>Check it&apos;s them before handing it over.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm">
              <p className="font-medium">{order.customer.name}</p>
              {order.customer.phone && <p className="text-muted-foreground">{formatPhoneNumber(order.customer.phone)}</p>}
              {order.customer.email && <p className="text-muted-foreground">{order.customer.email}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hand over</CardTitle>
              <CardDescription>{order.readyForCollectionAt ? `Customer told ${formatDate(order.readyForCollectionAt, "MMM d, h:mm a")}.` : "When the customer comes in."}</CardDescription>
            </CardHeader>
            <CardContent>
              <HandOver storeId={storeId} order={order} />
            </CardContent>
          </Card>

          {order.collection && <CollectionCard order={{ id: order.id, status: order.status }} collection={order.collection} />}
        </div>
      </div>
    </div>
  )
}
