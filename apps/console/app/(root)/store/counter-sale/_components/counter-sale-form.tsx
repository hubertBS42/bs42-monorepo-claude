"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleCheck, FileText } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { DiscountType, PaymentMethod, ShippingMethod } from "@workspace/db/enums"
import { NumberInputField, SelectField, TextInputField } from "@workspace/forms"
import { useRevalidateOnChange } from "@workspace/forms/use-revalidate-on-change"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatCurrency } from "@workspace/utils/currency"
import { useMemberRole } from "@/hooks/use-member-role"
import { completeCounterSaleAction, previewStoreOrderAction } from "@/lib/actions/store-order.actions"
import { createStoreOrderFormSchema, STAFF_ORDER_PAYMENT_METHODS } from "@/lib/schemas/order.schemas"
import type { OrderPreview, QuoteCustomer } from "@/types"
import type { ChosenItem, OrderFormInput, OrderFormOutput } from "../../orders/create/_components/create-order-form"
import ItemsStep from "../../orders/create/_components/steps/items-step"
import CustomerCard from "./customer-card"

// The create-order form's fields, so the items list is the wizard's. A counter sale is always a pickup, with no fee.
const DEFAULT_VALUES: OrderFormInput = {
  customerUserId: null,
  customerName: "Walk-in customer",
  customerEmail: "",
  customerPhone: "",
  items: [],
  shippingMethod: ShippingMethod.PICKUP,
  shippingName: "",
  shippingPhone: "",
  shippingLine1: "",
  shippingLine2: "",
  shippingRegion: "",
  shippingTown: "",
  shippingGhs: 0,
  discountType: "NONE",
  discountValue: 0,
  discountReason: "",
  notes: "",
}

const discountOptions = [
  { label: "No discount", value: "NONE" },
  { label: "Fixed amount (GH₵)", value: DiscountType.FIXED },
  { label: "Percentage", value: DiscountType.PERCENTAGE },
]

const ghs = (amount: string) => formatCurrency(amount, "GHS", "en-GH")

const TotalRow = ({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) => (
  <div className={strong ? "flex justify-between text-lg font-semibold" : "flex justify-between text-sm"}>
    <span className={strong ? undefined : "text-muted-foreground"}>{label}</span>
    <span>{amount}</span>
  </div>
)

type CompletedSale = { id: string; reference: string; invoiceUrl: string; totalGhs: string; paymentMethod: PaymentMethod }

export default function CounterSaleForm({ storeId }: { storeId: string }) {
  const [isPending, startTransition] = useTransition()
  const [chosen, setChosen] = useState<Record<string, ChosenItem>>({})
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH)
  const [priced, setPriced] = useState<{ key: string; preview: OrderPreview | null; error: string | null } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [completed, setCompleted] = useState<CompletedSale | null>(null)
  // The account found, whose trade discount applies unless an owner or admin sets another
  const [customer, setCustomer] = useState<QuoteCustomer | null>(null)
  const { role, isLoading } = useMemberRole(storeId)
  const canDiscount = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { order: ["update"] } })

  const form = useForm<OrderFormInput, unknown, OrderFormOutput>({ resolver: zodResolver(createStoreOrderFormSchema), defaultValues: DEFAULT_VALUES })
  useRevalidateOnChange(form)
  const items = useWatch({ control: form.control, name: "items" })
  const discountType = useWatch({ control: form.control, name: "discountType" })
  const discountValue = useWatch({ control: form.control, name: "discountValue" })

  const itemsReady = items.length > 0 && items.every((item) => typeof item.quantity === "number" && item.quantity >= 1)
  const discountReady = discountType === "NONE" || (typeof discountValue === "number" && discountValue > 0)
  const customerUserId = customer?.id ?? null
  const pricingKey = JSON.stringify({ items, discountType, discountValue, customerUserId, refreshKey })
  // Only the answer for what's on the page now: anything older is out of date
  const preview = priced?.key === pricingKey ? priced.preview : null
  const previewError = priced?.key === pricingKey ? priced.error : null

  // The server prices it the same way it will when it's completed, a moment after the last change. The sale goes
  // through only at the total showing, which is what the customer pays.
  useEffect(() => {
    if (!itemsReady || !discountReady) return
    let isCurrent = true
    const timer = setTimeout(() => {
      previewStoreOrderAction({
        storeId,
        customerUserId,
        items: items.map((item) => ({ listingId: item.listingId, listingVariantId: item.listingVariantId ?? null, quantity: Number(item.quantity) })),
        shippingGhs: 0,
        discountType,
        discountValue: typeof discountValue === "number" ? discountValue : 0,
      })
        .then((response) => {
          if (!isCurrent) return
          setPriced(response.success ? { key: pricingKey, preview: response.data, error: null } : { key: pricingKey, preview: null, error: response.error })
        })
        .catch(() => isCurrent && setPriced({ key: pricingKey, preview: null, error: "Unable to price the sale." }))
    }, 400)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
    // pricingKey covers the items and the discount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, pricingKey, itemsReady, discountReady])

  const complete = form.handleSubmit((values) => {
    if (!preview) return
    startTransition(async () => {
      const response = await completeCounterSaleAction({ ...values, storeId, paymentMethod: paymentMethod as (typeof STAFF_ORDER_PAYMENT_METHODS)[number], expectedTotalGhs: preview.totalGhs })
      if (!response.success) {
        toast.add({ title: "Unable to complete the sale", description: response.error, type: "error" })
        if (response.code === "CUSTOMER_NOT_FOUND") {
          setCustomer(null)
          form.setValue("customerUserId", null)
        }
        // A new price, or stock that ran out: the items list and the total show it
        setRefreshKey((key) => key + 1)
        return
      }
      setCompleted({ ...response.data, totalGhs: preview.totalGhs, paymentMethod })
    })
  })

  const startNewSale = () => {
    form.reset(DEFAULT_VALUES)
    setChosen({})
    setPaymentMethod(PaymentMethod.CASH)
    setPriced(null)
    setCustomer(null)
    setCompleted(null)
  }

  if (completed) {
    return (
      <Card className="mx-auto w-full max-w-lg text-center">
        <CardHeader>
          <CircleCheck className="mx-auto mb-2 size-10 text-emerald-600 dark:text-emerald-500" aria-hidden />
          <CardTitle>Sale complete</CardTitle>
          <CardDescription>{`${completed.reference}: ${ghs(completed.totalGhs)} by ${PAYMENT_METHOD_LABELS[completed.paymentMethod].toLowerCase()}.`}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={startNewSale}>
            New sale
          </Button>
          <Button render={<a href={completed.invoiceUrl} target="_blank" rel="noopener noreferrer" />} variant="outline">
            <FileText data-icon="inline-start" aria-hidden />
            Print invoice
          </Button>
          <Link href={`/store/orders/${completed.id}/details`} className={buttonVariants({ variant: "ghost" })}>
            View order
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    // Not a form element: Enter in the search box or a quantity must never complete a sale
    <div className="grid gap-4">
      <ItemsStep storeId={storeId} form={form} chosen={chosen} onChosenChange={setChosen} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <CustomerCard storeId={storeId} form={form} customer={customer} onCustomerChange={setCustomer} />

          {/* Members can't give discounts, so only owners and admins see this */}
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            canDiscount && (
              <Card>
                <CardHeader>
                  <CardTitle>Discount</CardTitle>
                  <CardDescription>{customer?.trade ? "Replaces their trade discount." : "Shared across the items and taken off before tax."}</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <SelectField control={form.control} name="discountType" aria-label="Discount" options={discountOptions} />
                    {discountType !== "NONE" && (
                      <>
                        <NumberInputField
                          control={form.control}
                          label={discountType === DiscountType.PERCENTAGE ? "Percentage" : "Amount"}
                          name="discountValue"
                          step={0.01}
                          min={0}
                          prependText={discountType === DiscountType.PERCENTAGE ? "%" : "GH₵"}
                        />
                        <TextInputField control={form.control} label="Reason" name="discountReason" placeholder="Shown on the invoice" />
                      </>
                    )}
                  </FieldGroup>
                </CardContent>
              </Card>
            )
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
            <CardDescription>Take the payment, then complete the sale.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {previewError ? (
              <p className="text-sm text-destructive">{previewError}</p>
            ) : preview ? (
              <div className="grid gap-1.5">
                <TotalRow label="Subtotal" amount={ghs(preview.subtotalGhs)} />
                {preview.discountAmountGhs && Number(preview.discountAmountGhs) > 0 && (
                  <TotalRow label={customer?.trade && discountType === "NONE" ? `Trade discount (${Number(customer.trade.percent)}%)` : "Discount"} amount={`−${ghs(preview.discountAmountGhs)}`} />
                )}
                <TotalRow label={Number(preview.taxRate) ? `Tax (${+(Number(preview.taxRate) * 100).toFixed(2)}%)` : "Tax"} amount={ghs(preview.taxGhs)} />
                <Separator className="my-1" />
                <TotalRow label="Total" amount={ghs(preview.totalGhs)} strong />
              </div>
            ) : itemsReady && discountReady ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Add items to see the total.</p>
            )}

            <div className="grid gap-2">
              <p className="text-sm font-medium">Paid by</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Paid by">
                {STAFF_ORDER_PAYMENT_METHODS.map((method) => (
                  <Button key={method} type="button" variant={paymentMethod === method ? "default" : "outline"} aria-pressed={paymentMethod === method} onClick={() => setPaymentMethod(method)}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Not until the total it will go through at is showing */}
            <Button type="button" size="lg" onClick={() => void complete()} disabled={isPending || !preview}>
              {isPending ? <Spinner /> : "Complete sale"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
