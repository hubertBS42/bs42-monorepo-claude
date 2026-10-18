"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { SubmitHandler, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { OrderStatus, type PaymentStatus, type ShippingMethod } from "@workspace/db/enums"
import { SelectField, TextareaField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useCanUpdateOrders } from "@/hooks/use-can-update-orders"
import { updateOrderStatusAction } from "@/lib/actions/order.actions"
import { updateStoreOrderStatusAction } from "@/lib/actions/store-order.actions"
import { hasBeenPaid, isPaid, nextOrderStatuses, ORDER_STATUS_LABELS } from "@/lib/order-status"
import { orderStatusFormSchema } from "@/lib/schemas/order.schemas"

type FormInput = z.input<typeof orderStatusFormSchema>
type FormOutput = z.output<typeof orderStatusFormSchema>

interface UpdateOrderStatusProps {
  // The store whose page this is, or null on the platform's pages
  storeId: string | null
  order: { id: string; status: OrderStatus; paymentStatus: PaymentStatus; shippingMethod: ShippingMethod }
  // Other stores' items too: on a store's page, the platform manages the order
  isMultiStore: boolean
}

export default function UpdateOrderStatus({ storeId, order, isMultiStore }: UpdateOrderStatusProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { canUpdate, isLoading } = useCanUpdateOrders(storeId)
  // Cancelling a paid order needs a refund: superAdmins, or a store's owners and admins
  const { canUpdate: canRefund, bySystemRole: refundsBySystemRole } = useCanUpdateOrders(storeId, "refund")

  const options = nextOrderStatuses(order.status, order.shippingMethod).map((status) => ({ label: ORDER_STATUS_LABELS[status], value: status }))
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(orderStatusFormSchema),
    defaultValues: { status: options[0]?.value, note: "" },
  })
  const selected = useWatch({ control: form.control, name: "status" })

  if (isLoading) return <Skeleton className="h-24 rounded-md" />

  // Shown as text because a disabled button never shows its title tooltip, and screen readers skip it
  const blockedReason =
    storeId && isMultiStore
      ? "This order has items from other stores, so the platform manages its status."
      : !canUpdate
        ? storeId
          ? "Your role in this store can't change order statuses."
          : "Your role can't change order statuses."
        : options.length === 0
          ? "This order is finished: its status can't change any more."
          : null
  if (blockedReason) return <p className="text-sm text-muted-foreground">{blockedReason}</p>

  const onSubmit: SubmitHandler<FormOutput> = ({ status, note }) => {
    startTransition(async () => {
      const change = { orderId: order.id, status, note, currentStatus: order.status }
      const response = storeId ? await updateStoreOrderStatusAction({ ...change, storeId }) : await updateOrderStatusAction(change)

      if (!response.success) {
        toast.add({ title: "Unable to update the order", description: response.error, type: "error" })
        // Someone else moved it on: show where it is now
        if (response.code === "STATUS_CHANGED") router.refresh()
        return
      }

      toast.add({ title: "Order updated", description: `The order is now ${ORDER_STATUS_LABELS[status].toLowerCase()}.`, type: "success" })
      router.refresh()
    })
  }

  const cancelling = selected === OrderStatus.CANCELLED
  // The actions refuse both; saying so here saves a round trip
  const blockedChoice =
    cancelling && isPaid(order.paymentStatus)
      ? canRefund
        ? "This order has been paid, so cancelling it needs a refund. Use Cancel and refund instead."
        : `This order has been paid, so cancelling it needs a refund. Ask ${refundsBySystemRole ? "a superAdmin" : "an owner or admin of the store"} to cancel and refund it.`
      : selected === OrderStatus.COMPLETED && !hasBeenPaid(order.paymentStatus)
        ? "Record the payment before completing the order."
        : null

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
      <SelectField control={form.control} label="New status" name="status" options={options} disabled={isPending} />
      <TextareaField
        control={form.control}
        label={cancelling ? "Reason for cancelling" : "Note (optional)"}
        name="note"
        placeholder={cancelling ? "Why is the order being cancelled?" : "Anything worth keeping in the timeline"}
        disabled={isPending}
      />
      {blockedChoice && <p className="text-sm text-destructive">{blockedChoice}</p>}
      <Button type="submit" disabled={isPending || !!blockedChoice} variant={cancelling ? "destructive" : "default"}>
        {isPending ? <Spinner /> : cancelling ? "Cancel order" : "Update status"}
      </Button>
    </form>
  )
}
