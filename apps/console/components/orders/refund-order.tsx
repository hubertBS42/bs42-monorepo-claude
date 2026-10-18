"use client"

import { useState, useTransition, type ReactElement, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from "react-hook-form"
import type { z } from "zod"
import type { ActionResponse } from "@workspace/contracts"
import type { OrderStatus, PaymentMethod } from "@workspace/db/enums"
import { NumberInputField, SelectField, TextareaField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { FieldGroup } from "@workspace/ui/components/field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatCurrency } from "@workspace/utils/currency"
import { useCanUpdateOrders } from "@/hooks/use-can-update-orders"
import { cancelAndRefundOrderAction, refundOrderAction } from "@/lib/actions/order.actions"
import { cancelAndRefundStoreOrderAction, refundStoreOrderAction } from "@/lib/actions/store-order.actions"
import { PAYMENT_METHOD_LABELS } from "@/lib/order-status"
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

// The form holds the schema's input (an amount field can be empty) and submits its output. Returns use it too.
interface RefundDialogProps<In extends FieldValues, Out extends FieldValues> {
  trigger: ReactElement
  title: string
  description: string
  submitLabel: string
  // The error toast's title
  failureTitle?: string
  destructive?: boolean
  className?: string
  schema: z.ZodType<Out, In>
  values: In
  save: (values: Out) => Promise<ActionResponse>
  success: (values: Out) => { title: string; description: string }
  children: (form: UseFormReturn<In, unknown, Out>, isPending: boolean) => ReactNode
}

export function RefundDialog<In extends FieldValues, Out extends FieldValues>({
  trigger,
  title,
  description,
  submitLabel,
  failureTitle = "Unable to refund",
  destructive,
  className,
  schema,
  values,
  save,
  success,
  children,
}: RefundDialogProps<In, Out>) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(schema), defaultValues: values as DefaultValues<In> })

  const onSubmit = (submitted: Out) => {
    startTransition(async () => {
      const response = await save(submitted)
      if (!response.success) {
        toast.add({ title: failureTitle, description: response.error, type: "error" })
        // The order changed under the page: show it as it is now
        if (response.code === "REFUNDS_CHANGED" || response.code === "STATUS_CHANGED" || response.code === "NOT_PAID" || response.code === "RETURNS_CHANGED" || response.code === "NOT_RETURNABLE") {
          setIsOpen(false)
          router.refresh()
        }
        return
      }
      setIsOpen(false)
      toast.add({ ...success(submitted), type: "success" })
      router.refresh()
    })
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Reset on open: onOpenChange doesn't run when a save closes the dialog
        if (open) form.reset(values)
        setIsOpen(open)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* The dialog is portaled, but React events still bubble to any form it's rendered inside */}
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            form.handleSubmit(onSubmit)(e)
          }}
          className="grid gap-6"
        >
          <FieldGroup>{children(form, isPending)}</FieldGroup>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setIsOpen(false)}>
              Back
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={isPending}>
              {isPending ? <Spinner /> : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
      <RefundDialog
        trigger={
          <Button type="button" variant="outline">
            Refund
          </Button>
        }
        title="Refund"
        description={`Up to ${ghs(refundableGhs)} is left to refund. The order's status stays as it is, and no stock comes back: for items brought back, use Record return.`}
        submitLabel="Refund"
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
      </RefundDialog>

      {canCancel && (
        <RefundDialog
          trigger={
            <Button type="button" variant="destructive">
              Cancel and refund
            </Button>
          }
          title="Cancel and refund"
          description={`The order is cancelled, its stock goes back on sale, and the ${ghs(refundableGhs)} left is refunded.`}
          submitLabel="Cancel and refund"
          destructive
          schema={cancelAndRefundFormSchema}
          values={{ method: paymentMethod, reason: "" }}
          save={(values) =>
            storeId ? cancelAndRefundStoreOrderAction({ ...values, ...target, currentStatus: status, storeId }) : cancelAndRefundOrderAction({ ...values, ...target, currentStatus: status })
          }
          success={() => ({ title: "Order cancelled", description: `${ghs(refundableGhs)} refunded.` })}
        >
          {(form, isPending) => <MethodAndReason form={form} isPending={isPending} />}
        </RefundDialog>
      )}
    </div>
  )
}
