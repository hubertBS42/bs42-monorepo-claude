"use client"

import type { FieldValues, UseFormReturn } from "react-hook-form"
import type { OrderStatus, PaymentMethod } from "@workspace/db/enums"
import { NumberInputField, SelectField, TextareaField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { formatCurrency } from "@workspace/utils/currency"
import FormDialog from "@/components/form-dialog"
import { useCanUpdateOrders } from "@/hooks/use-can-update-orders"
import { cancelAndRefundOrderAction, refundOrderAction } from "@/lib/actions/order.actions"
import { cancelAndRefundStoreOrderAction, refundStoreOrderAction } from "@/lib/actions/store-order.actions"
import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { cancelAndRefundFormSchema, refundOrderFormSchema } from "@/lib/schemas/order.schemas"

// Refunds, for superAdmins on the platform's pages and owners and admins on a store's own orders (storeId): part or
// all of what's left, or cancelling the order with a refund of the rest. The page shows these only for an order that
// holds money (paid, or partly refunded), so there's always some left; the actions check the permission and the
// amounts again.

const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ label, value }))
const ghs = (amount: string | number) => formatCurrency(String(amount), "GHS", "en-GH")

interface RefundTarget {
  // The store whose order it is, or null on the platform's pages
  storeId: string | null
  orderId: string
  // What the page showed as refunded so far, and what's left
  refundedGhs: string
  refundableGhs: string
  // How the customer paid: the usual way to give it back
  paymentMethod: PaymentMethod
}

// What the refund and return dialogs refresh on: the order changed under the page, so show it as it is now
export const REFUND_REFRESH_CODES = ["REFUNDS_CHANGED", "STATUS_CHANGED", "NOT_PAID", "RETURNS_CHANGED", "NOT_RETURNABLE"]

function MethodAndReason<In extends FieldValues, Out extends FieldValues>({ form, isPending }: { form: UseFormReturn<In, unknown, Out>; isPending: boolean }) {
  // Both refund forms have these two fields; the casts only name them for react-hook-form
  const control = form.control as unknown as UseFormReturn<{ method: string; reason: string }>["control"]
  return (
    <>
      <SelectField control={control} label="Given back by" name="method" options={methodOptions} disabled={isPending} />
      <TextareaField control={control} label="Reason" name="reason" placeholder="The customer is told this" disabled={isPending} />
    </>
  )
}

interface OrderRefundsProps extends RefundTarget {
  // The order's status, and whether it can still be cancelled (it hasn't left)
  status: OrderStatus
  canCancel: boolean
}

// Who may refund, for the line shown to everyone else: platform staff are told about superAdmins, even in a store
export const refundersLabel = (bySystemRole: boolean) => (bySystemRole ? "superAdmins" : "the store's owners and admins")

export default function OrderRefunds({ storeId, orderId, refundedGhs, refundableGhs, paymentMethod, status, canCancel }: OrderRefundsProps) {
  const { canUpdate: canRefund, isLoading, bySystemRole } = useCanUpdateOrders(storeId, "refund")

  if (isLoading) return <Skeleton className="h-9 rounded-md" />

  if (!canRefund) return <p className="text-sm text-muted-foreground">{`Only ${refundersLabel(bySystemRole)} can give refunds.`}</p>

  const target = { orderId, refundedGhs }
  const refundable = Number(refundableGhs)

  return (
    <div className="grid gap-2">
      <FormDialog
        trigger={
          <Button type="button" variant="outline">
            Refund
          </Button>
        }
        title="Refund"
        description={`Up to ${ghs(refundableGhs)} left. This doesn't restock: use Record return for items brought back.`}
        submitLabel="Refund"
        failureTitle="Unable to refund"
        refreshOn={REFUND_REFRESH_CODES}
        schema={refundOrderFormSchema}
        values={{ amountGhs: "", method: paymentMethod, reason: "" }}
        save={(values) => (storeId ? refundStoreOrderAction({ ...values, ...target, storeId }) : refundOrderAction({ ...values, ...target }))}
        success={(values) => ({ title: "Refunded", description: `${ghs(values.amountGhs)} refunded.` })}
      >
        {(form, isPending) => (
          <>
            <NumberInputField control={form.control} label="Amount" name="amountGhs" step={0.01} min={0.01} max={refundable} prependText="GH₵" disabled={isPending} />
            <MethodAndReason form={form} isPending={isPending} />
          </>
        )}
      </FormDialog>

      {canCancel && (
        <FormDialog
          trigger={
            <Button type="button" variant="destructive">
              Cancel and refund
            </Button>
          }
          title="Cancel and refund"
          description={`Cancels the order, restocks it and refunds ${ghs(refundableGhs)}.`}
          submitLabel="Cancel and refund"
          failureTitle="Unable to refund"
          refreshOn={REFUND_REFRESH_CODES}
          destructive
          schema={cancelAndRefundFormSchema}
          values={{ method: paymentMethod, reason: "" }}
          save={(values) =>
            storeId ? cancelAndRefundStoreOrderAction({ ...values, ...target, currentStatus: status, storeId }) : cancelAndRefundOrderAction({ ...values, ...target, currentStatus: status })
          }
          success={() => ({ title: "Order cancelled", description: `${ghs(refundableGhs)} refunded.` })}
        >
          {(form, isPending) => <MethodAndReason form={form} isPending={isPending} />}
        </FormDialog>
      )}
    </div>
  )
}
