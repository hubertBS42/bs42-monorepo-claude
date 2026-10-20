"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PaymentMethod } from "@workspace/db/enums"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatCurrency } from "@workspace/utils/currency"
import { useCanUpdateOrders } from "@/hooks/use-can-update-orders"
import { recordOrderPaymentAction } from "@/lib/actions/order.actions"
import { recordStorePaymentAction } from "@/lib/actions/store-order.actions"
import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"

const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ label, value: value as PaymentMethod }))

interface RecordPaymentProps {
  // The store whose page this is, or null on the platform's pages
  storeId: string | null
  orderId: string
  // The order's total; null on a store's page when other stores' items make it the platform's
  totalGhs: string | null
  defaultMethod: PaymentMethod
}

// Shown for an unpaid order; the actions check again
export default function RecordPayment({ storeId, orderId, totalGhs, defaultMethod }: RecordPaymentProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod)
  const { canUpdate, isLoading } = useCanUpdateOrders(storeId)

  if (isLoading) return <Skeleton className="h-9 rounded-md" />

  if (!canUpdate || totalGhs === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {totalGhs === null ? "The platform records payment for orders with other stores' items." : storeId ? "Your role in this store can't record payments." : "Your role can't record payments."}
      </p>
    )
  }

  const handleRecord = () => {
    startTransition(async () => {
      const response = storeId ? await recordStorePaymentAction({ storeId, orderId, paymentMethod: method }) : await recordOrderPaymentAction({ orderId, paymentMethod: method })

      if (!response.success) {
        toast.add({ title: "Unable to record the payment", description: response.error, type: "error" })
        if (response.code === "PAYMENT_CHANGED" || response.code === "CANCELLED") router.refresh()
        return
      }

      toast.add({ title: "Payment recorded", description: `${formatCurrency(totalGhs, "GHS", "en-GH")} paid by ${PAYMENT_METHOD_LABELS[method].toLowerCase()}.`, type: "success" })
      router.refresh()
    })
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="payment-method">Paid by</Label>
        <Select items={methodOptions} value={method} onValueChange={(value) => value && setMethod(value as PaymentMethod)} disabled={isPending}>
          <SelectTrigger id="payment-method" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {methodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" onClick={handleRecord} disabled={isPending}>
        {isPending ? <Spinner /> : `Record ${formatCurrency(totalGhs, "GHS", "en-GH")} paid`}
      </Button>
    </div>
  )
}
