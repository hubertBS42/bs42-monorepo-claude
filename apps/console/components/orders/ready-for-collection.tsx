"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { OrderStatus, ShippingMethod } from "@workspace/db/enums"
import Link from "next/link"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatDate } from "@workspace/utils/date"
import { useCanUpdateOrders } from "@/hooks/use-can-update-orders"
import { markOrderReadyAction } from "@/lib/actions/order.actions"
import { markStoreOrderReadyAction } from "@/lib/actions/store-order.actions"

interface ReadyForCollectionProps {
  // The store whose page this is, or null on the platform's pages
  storeId: string | null
  order: {
    id: string
    status: OrderStatus
    shippingMethod: ShippingMethod
    readyForCollectionAt: Date | null
    customer: { email: string | null }
    collection: { rows: { transfer: { status: string } | null }[] } | null
    // The store whose branch it's collected at
    pickupLocationStoreId: string | null
  }
  // Other stores' items too: on a store's page, the platform manages the order
  isMultiStore: boolean
}

// Under the status card on a pickup order: says when it was ready, or tells the customer it is
export default function ReadyForCollection({ storeId, order, isMultiStore }: ReadyForCollectionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { canUpdate, isLoading } = useCanUpdateOrders(storeId)

  if (order.shippingMethod !== ShippingMethod.PICKUP) return null
  const isOpen = order.status === OrderStatus.PENDING || order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.PROCESSING
  // Someone who can't change orders here (a member at the counter) hands it over from Collections, at its branch
  if (!isLoading && !canUpdate) {
    return isOpen && storeId && order.pickupLocationStoreId === storeId ? (
      <Link href={`/store/collections/${order.id}`} className={buttonVariants({ variant: "outline", className: "justify-self-start" })}>
        Hand over in Collections
      </Link>
    ) : null
  }
  if (order.readyForCollectionAt) return <p className="text-sm text-muted-foreground">{`Ready for collection since ${formatDate(order.readyForCollectionAt, "MMM d, yyyy, h:mm a")}.`}</p>

  const canBeReady = order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.PROCESSING
  if (isLoading || !canUpdate || !canBeReady || (storeId && isMultiStore)) return null
  // Items from other branches arrive first
  if (order.collection?.rows.some((row) => row.transfer?.status !== "RECEIVED")) return <p className="text-sm text-muted-foreground">Ready for collection once the items from other branches arrive.</p>

  const mark = () => {
    startTransition(async () => {
      const response = storeId ? await markStoreOrderReadyAction({ storeId, orderId: order.id }) : await markOrderReadyAction({ orderId: order.id })
      if (!response.success) {
        toast.add({ title: "Unable to mark it ready", description: response.error, type: "error" })
      } else {
        toast.add({ title: "Marked ready", description: order.customer.email ? "We've emailed the customer." : "They have no email, so tell them yourself.", type: "success" })
      }
      router.refresh()
    })
  }

  return (
    <Button type="button" variant="outline" className="justify-self-start" onClick={mark} disabled={isPending}>
      {isPending ? <Spinner /> : "Mark ready for collection"}
    </Button>
  )
}
