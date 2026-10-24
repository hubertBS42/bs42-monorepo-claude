"use client"

import { useEffect, useState } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import type { z } from "zod"
import type { PaymentMethod } from "@workspace/db/enums"
import { NumberInputField, SelectField, SwitchField, TextareaField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { FieldDescription } from "@workspace/ui/components/field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { formatCurrency } from "@workspace/utils/currency"
import { useCanUpdateOrders } from "@/hooks/use-can-update-orders"
import { returnOrderItemsAction } from "@/lib/actions/order.actions"
import { returnStoreOrderItemsAction } from "@/lib/actions/store-order.actions"
import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { returnOrderFormSchema } from "@/lib/schemas/order.schemas"
import type { ReturnableLine } from "@/types"
import FormDialog from "@/components/form-dialog"
import { REFUND_REFRESH_CODES, refundersLabel } from "./refund-order"

// Items a customer brings back once the order reached them, for whoever may give refunds (superAdmins, or a store's
// owners and admins on its own orders): how many of each line, whether they go
// back on sale, and the refund, which starts at what those units cost the customer (shipping isn't refunded) and can
// be changed. The action checks the permission, the quantities and the amount again.

type ReturnFormInput = z.input<typeof returnOrderFormSchema>
type ReturnFormOutput = z.output<typeof returnOrderFormSchema>

const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ label, value }))
const ghs = (amount: string | number) => formatCurrency(String(amount), "GHS", "en-GH")
// The amounts have two decimal places, so they add up exactly in cents
const toCents = (amount: string) => Math.round(Number(amount) * 100)

interface RecordReturnProps {
  // The store whose order it is, or null on the platform's pages
  storeId: string | null
  orderId: string
  // What the page showed, so a return or refund made meanwhile is refused
  refundedGhs: string
  returnCount: number
  // What's left to refund; nothing when the order holds no money (unpaid, or already refunded)
  refundableGhs: string
  canRefund: boolean
  paymentMethod: PaymentMethod
  lines: ReturnableLine[]
  showStore: boolean
}

function ReturnFields({
  form,
  isPending,
  lines,
  refundable,
  canRefund,
  showStore,
}: {
  form: UseFormReturn<ReturnFormInput, unknown, ReturnFormOutput>
  isPending: boolean
  lines: ReturnableLine[]
  refundable: number
  canRefund: boolean
  showStore: boolean
}) {
  const items = useWatch({ control: form.control, name: "items" })
  const amount = useWatch({ control: form.control, name: "refundAmountGhs" })
  // The amount follows the items until it's typed over
  const [amountTyped, setAmountTyped] = useState(false)

  const valueCents = lines.reduce((sum, line, index) => {
    const quantity = Number(items?.[index]?.quantity) || 0
    return sum + toCents(line.valueByQuantity[Math.min(quantity, line.left)] ?? "0")
  }, 0)
  const suggested = Math.min(valueCents, Math.round(refundable * 100)) / 100

  useEffect(() => {
    if (!amountTyped && canRefund) form.setValue("refundAmountGhs", suggested)
  }, [amountTyped, canRefund, form, suggested])

  const itemsError = form.formState.errors.items?.root?.message ?? form.formState.errors.items?.message

  return (
    <>
      <div className="grid gap-3">
        {lines.map((line, index) => (
          <div key={line.orderItemId} className="grid gap-2 rounded-lg border p-3">
            <div className="grid gap-0.5">
              <span className="text-sm font-medium">{line.productName}</span>
              <span className="text-xs text-muted-foreground">{[line.variantDescription, showStore ? `From ${line.storeName}` : null, `${line.left} can come back`].filter(Boolean).join(" · ")}</span>
            </div>
            <div className="grid items-end gap-3 sm:grid-cols-2">
              <NumberInputField control={form.control} label="Coming back" name={`items.${index}.quantity`} step={1} min={0} max={line.left} disabled={isPending} />
              {line.tracksStock ? (
                <SwitchField control={form.control} label="Put back in stock" name={`items.${index}.restock`} disabled={isPending} />
              ) : (
                <p className="text-xs text-muted-foreground">Its listing didn&apos;t track stock when it sold, so there&apos;s none to put back.</p>
              )}
            </div>
          </div>
        ))}
        {itemsError && <p className="text-sm text-destructive">{itemsError}</p>}
      </div>

      <TextareaField control={form.control} label="Reason" name="reason" placeholder="The customer is told this" disabled={isPending} />

      {canRefund ? (
        <>
          <div className="grid gap-1">
            <NumberInputField
              control={form.control}
              label="Refund"
              name="refundAmountGhs"
              step={0.01}
              min={0}
              max={refundable}
              prependText="GH₵"
              disabled={isPending}
              onValueChange={() => setAmountTyped(true)}
            />
            <FieldDescription>
              {`These items cost ${ghs(valueCents / 100)}${valueCents / 100 > refundable ? `, but only ${ghs(refundable)} is left` : ""}. Shipping isn't refunded.`}
              {amountTyped && Number(amount) !== suggested && (
                <>
                  {" "}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      form.setValue("refundAmountGhs", suggested)
                      setAmountTyped(false)
                    }}
                  >
                    {`Use ${ghs(suggested)}`}
                  </Button>
                </>
              )}
            </FieldDescription>
          </div>
          {Number(amount) > 0 && <SelectField control={form.control} label="Given back by" name="method" options={methodOptions} disabled={isPending} />}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing is left to refund on this order, so the return is recorded without a refund.</p>
      )}
    </>
  )
}

export default function RecordReturn({ storeId, orderId, refundedGhs, returnCount, refundableGhs, canRefund, paymentMethod, lines, showStore }: RecordReturnProps) {
  // Returns go with refunds, so they take the same permission
  const { canUpdate: canReturn, isLoading, bySystemRole } = useCanUpdateOrders(storeId, "refund")

  if (isLoading) return <Skeleton className="h-9 rounded-md" />

  if (!canReturn) return <p className="text-sm text-muted-foreground">{`Only ${refundersLabel(bySystemRole)} can record returns.`}</p>

  const refundable = canRefund ? Number(refundableGhs) : 0

  return (
    <FormDialog
      trigger={
        <Button type="button" variant="outline">
          Record return
        </Button>
      }
      title="Record return"
      info="The suggested refund is what those units cost the customer after their share of the discount, with tax. Only items that track stock can go back into it."
      description="Choose what the customer brought back."
      submitLabel="Record return"
      failureTitle="Unable to record the return"
      refreshOn={REFUND_REFRESH_CODES}
      className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
      schema={returnOrderFormSchema}
      values={{
        items: lines.map((line) => ({ orderItemId: line.orderItemId, quantity: 0, restock: false })),
        reason: "",
        refundAmountGhs: 0,
        method: paymentMethod,
      }}
      save={(values) => {
        const target = { ...values, refundAmountGhs: canRefund ? values.refundAmountGhs : 0, orderId, refundedGhs, returnCount }
        return storeId ? returnStoreOrderItemsAction({ ...target, storeId }) : returnOrderItemsAction(target)
      }}
      success={(values) => {
        const count = values.items.reduce((sum, item) => sum + item.quantity, 0)
        const refund = canRefund ? values.refundAmountGhs : 0
        return { title: "Return recorded", description: `${count === 1 ? "1 item" : `${count} items`} returned${refund > 0 ? `, ${ghs(refund)} refunded` : ""}.` }
      }}
    >
      {(form, isPending) => <ReturnFields form={form} isPending={isPending} lines={lines} refundable={refundable} canRefund={canRefund} showStore={showStore} />}
    </FormDialog>
  )
}
