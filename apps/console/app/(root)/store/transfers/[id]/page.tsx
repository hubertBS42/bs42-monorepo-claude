import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import z from "zod"
import { StockTransferStatus } from "@workspace/db/enums"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { formatDate } from "@workspace/utils/date"
import BackButton from "@/components/back-button"
import { StockTransferStatusBadge } from "@/components/order-badges"
import { Detail } from "@/components/orders/order-details"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStockTransferDetails } from "@/lib/data/stock-transfers.data"
import TransferActions from "./_components/transfer-actions"

export const metadata: Metadata = {
  title: "Transfer",
}

type TransferPageProps = {
  params: Promise<{ id: string }>
}

const when = (date: Date | null, by: string | null) => (date ? `${formatDate(date, "MMM d, yyyy, h:mm a")}${by ? ` by ${by}` : ""}` : null)

export default async function TransferPage({ params }: TransferPageProps) {
  const { storeId } = await requireActiveStoreMember()

  const { id } = await params
  // A uuid column: anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getStockTransferDetails(storeId, id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }
  const transfer = response.data
  const out = transfer.direction === "out"
  const received = transfer.status === StockTransferStatus.RECEIVED
  // This store's own listing of each line, for its stock history
  const listingHref = (item: (typeof transfer.items)[number]) => `/store/listings/${out ? item.fromListingId : item.toListingId}/stock-history`

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-mono text-xl font-bold md:text-2xl">{transfer.reference}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{out ? `To ${transfer.toStore.name}` : `From ${transfer.fromStore.name}`}</span>
            <StockTransferStatusBadge status={transfer.status} />
          </div>
        </div>
        <BackButton link="/store/transfers" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <CardDescription>{received ? "What was sent and what arrived." : "What was sent."}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    {received && <TableHead className="text-right">Arrived</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfer.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="grid gap-0.5">
                          <Link href={listingHref(item)} className="w-fit underline-offset-4 hover:underline">
                            {item.productName}
                          </Link>
                          <span className="text-xs text-muted-foreground">{[item.variantDescription, item.sku].filter(Boolean).join(" · ")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      {received && <TableCell className={cn("text-right tabular-nums", (item.quantityReceived ?? 0) < item.quantity && "text-destructive")}>{item.quantityReceived ?? 0}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid auto-rows-max gap-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Detail label="From">{transfer.fromStore.name}</Detail>
              <Detail label="To">{transfer.toStore.name}</Detail>
              <Detail label="Sent">{when(transfer.createdAt, transfer.sentBy)}</Detail>
              {transfer.notes && (
                <Detail label="Notes">
                  <span className="whitespace-pre-line">{transfer.notes}</span>
                </Detail>
              )}
              {received && <Detail label="Received">{when(transfer.receivedAt, transfer.receivedBy)}</Detail>}
              {transfer.receiveNote && <Detail label="Note on receiving">{transfer.receiveNote}</Detail>}
              {transfer.status === StockTransferStatus.CANCELLED && (
                <>
                  <Detail label="Cancelled">{when(transfer.cancelledAt, transfer.cancelledBy)}</Detail>
                  {transfer.cancelReason && <Detail label="Reason">{transfer.cancelReason}</Detail>}
                </>
              )}
            </CardContent>
          </Card>

          {transfer.status === StockTransferStatus.SENT && (
            <Card>
              <CardHeader>
                <CardTitle>{out ? "On its way" : "Arriving"}</CardTitle>
                <CardDescription>{out ? `You can cancel it until ${transfer.toStore.name} receives it.` : "Shows as incoming until received."}</CardDescription>
              </CardHeader>
              <CardContent>
                <TransferActions storeId={storeId} transfer={transfer} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
