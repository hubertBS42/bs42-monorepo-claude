"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CollectionTransferStatus, OrderStatus } from "@workspace/db/enums"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatDate } from "@workspace/utils/date"
import { useCanUpdateOrders } from "@/hooks/use-can-update-orders"
import { useMemberRole } from "@/hooks/use-member-role"
import { cancelCollectionSendAction, receiveForCollectionAction, sendForCollectionAction } from "@/lib/actions/collection.actions"
import type { OrderCollection } from "@/types"

const CLOSED: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.DELIVERED, OrderStatus.COMPLETED]

// Items from other branches for a pickup collected elsewhere: each store sends its items, the collecting branch
// receives them. The buttons check the role in the store concerned; the actions check again.
export default function CollectionCard({ order, collection }: { order: { id: string; status: OrderStatus }; collection: OrderCollection }) {
  const arrived = collection.rows.every((row) => row.transfer?.status === CollectionTransferStatus.RECEIVED)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{`Collected at ${collection.locationName}`}</CardTitle>
        <CardDescription>{arrived ? "Everything has arrived." : "Items from other branches to bring there first."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {collection.rows.map((row) => (
          <CollectionRow key={row.storeId} orderId={order.id} closed={CLOSED.includes(order.status)} locationName={collection.locationName} locationStoreId={collection.locationStoreId} row={row} />
        ))}
      </CardContent>
    </Card>
  )
}

function CollectionRow({
  orderId,
  closed,
  locationName,
  locationStoreId,
  row,
}: {
  orderId: string
  closed: boolean
  locationName: string
  locationStoreId: string
  row: OrderCollection["rows"][number]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { canUpdate: canSend } = useCanUpdateOrders(row.storeId)
  const { role: collectingRole } = useMemberRole(locationStoreId)
  const transfer = row.transfer
  const run = (action: () => Promise<{ success: boolean; error?: string }>, done: string) =>
    startTransition(async () => {
      const response = await action()
      toast.add(response.success ? { title: done, type: "success" } : { title: "Unable to do that", description: response.error, type: "error" })
      router.refresh()
    })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="grid gap-0.5">
        <p className="text-sm font-medium">{`From ${row.storeName}: ${row.units} ${row.units === 1 ? "item" : "items"}`}</p>
        <p className="text-xs text-muted-foreground">
          {!transfer
            ? "Not sent yet"
            : transfer.status === CollectionTransferStatus.RECEIVED
              ? `Arrived ${formatDate(transfer.receivedAt!, "MMM d, h:mm a")}`
              : `Sent ${formatDate(transfer.sentAt, "MMM d, h:mm a")}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {transfer?.status === CollectionTransferStatus.RECEIVED && <Badge variant="success">Arrived</Badge>}
        {!transfer && !closed && canSend && (
          <Button type="button" size="sm" onClick={() => run(() => sendForCollectionAction({ orderId, fromStoreId: row.storeId }), `Sent to ${locationName}`)} disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            {`Send to ${locationName}`}
          </Button>
        )}
        {transfer?.status === CollectionTransferStatus.SENT && collectingRole !== null && (
          <Button type="button" size="sm" onClick={() => run(() => receiveForCollectionAction({ transferId: transfer.id }), "Marked received")} disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            Received
          </Button>
        )}
        {transfer?.status === CollectionTransferStatus.SENT && canSend && (
          <Button type="button" size="sm" variant="ghost" onClick={() => run(() => cancelCollectionSendAction({ transferId: transfer.id }), "Called back")} disabled={isPending}>
            Call back
          </Button>
        )}
      </div>
    </div>
  )
}
