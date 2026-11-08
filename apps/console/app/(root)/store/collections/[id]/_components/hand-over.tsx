"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatCurrency } from "@workspace/utils/currency"
import { PaymentMethodToggle, type StaffPaymentMethod } from "@/components/orders/payment-method-toggle"
import { handOverAction, markCollectionReadyAction } from "@/lib/actions/collection.actions"
import { STAFF_ORDER_PAYMENT_METHODS } from "@/lib/schemas/order.schemas"
import type { CollectionDetails } from "@/types"

// Telling the customer it's ready, and handing it over (taking the payment first when it's due)
export default function HandOver({ storeId, order }: { storeId: string; order: CollectionDetails }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [method, setMethod] = useState<StaffPaymentMethod>(STAFF_ORDER_PAYMENT_METHODS[2])
  const unpaid = order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED"
  const confirmed = order.status === "CONFIRMED" || order.status === "PROCESSING"

  const run = (action: () => Promise<{ success: boolean; error?: string }>, done: string) =>
    startTransition(async () => {
      const response = await action()
      toast.add(response.success ? { title: done, type: "success" } : { title: "Unable to do that", description: response.error, type: "error" })
      router.refresh()
    })

  if (order.state === "collected") return <p className="text-sm text-muted-foreground">Collected.</p>
  if (!confirmed) return <p className="text-sm text-muted-foreground">Waiting for the order to be confirmed.</p>
  if (order.state === "coming") return <p className="text-sm text-muted-foreground">Ready to hand over once the items from other branches arrive.</p>

  return (
    <div className="grid gap-4">
      {order.state === "here" && (
        <Button type="button" variant="outline" onClick={() => run(() => markCollectionReadyAction({ storeId, orderId: order.id }), "Customer told it's ready")} disabled={isPending}>
          Tell the customer it&apos;s ready
        </Button>
      )}
      {unpaid && (
        <div className="grid gap-2">
          <p className="text-sm">{`To pay on collection: ${formatCurrency(order.totalGhs, "GHS", "en-GH")}`}</p>
          {/* Stacked: the card sits in the page's narrow column */}
          <PaymentMethodToggle value={method} onValueChange={setMethod} orientation="vertical" />
        </div>
      )}
      <Button type="button" onClick={() => run(() => handOverAction({ storeId, orderId: order.id, paymentMethod: unpaid ? method : null }), "Handed over")} disabled={isPending}>
        {isPending && <Spinner data-icon="inline-start" />}
        {unpaid ? "Take payment and hand over" : "Hand over"}
      </Button>
    </div>
  )
}
