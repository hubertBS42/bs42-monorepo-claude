"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { PaymentMethod } from "@workspace/db/enums"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatCurrency } from "@workspace/utils/currency"
import { useMemberRole } from "@/hooks/use-member-role"
import { recordStorePaymentAction } from "@/lib/actions/store-order.actions"
import { PAYMENT_METHOD_LABELS } from "@/lib/order-status"

const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ label, value: value as PaymentMethod }))

interface RecordPaymentProps {
  storeId: string
  orderId: string
  // The order's total; null when other stores' items make it the platform's
  totalGhs: string | null
  defaultMethod: PaymentMethod
}

// Shown for an unpaid order the store manages; recordStorePaymentAction checks again
export default function RecordPayment({ storeId, orderId, totalGhs, defaultMethod }: RecordPaymentProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod)
  const { role, isLoading } = useMemberRole(storeId)

  if (isLoading) return <Skeleton className="h-9 rounded-md" />

  const canUpdate = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { order: ["update"] } })
  if (!canUpdate || totalGhs === null) {
    return <p className="text-sm text-muted-foreground">{totalGhs === null ? "The platform records payment for orders with other stores' items." : "Your role in this store can't record payments."}</p>
  }

  const handleRecord = () => {
    startTransition(async () => {
      const response = await recordStorePaymentAction({ storeId, orderId, paymentMethod: method })

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
