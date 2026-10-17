"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { FieldPath, SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import { ShippingMethod } from "@workspace/db/enums"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"
import { createStoreOrderAction } from "@/lib/actions/store-order.actions"
import { createStoreOrderFormSchema } from "@/lib/schemas/order.schemas"
import type { OrderCustomer } from "@/types"
import CustomerStep from "./steps/customer-step"
import DeliveryStep from "./steps/delivery-step"
import ItemsStep from "./steps/items-step"
import ReviewStep from "./steps/review-step"

export type OrderFormInput = z.input<typeof createStoreOrderFormSchema>
export type OrderFormOutput = z.output<typeof createStoreOrderFormSchema>

// What the cart and review show for a chosen line. The form itself holds only ids and quantities:
// prices are looked up on the server.
export interface ChosenItem {
  label: string
  sku: string | null
  priceGhs: string | null
  stock: number | null
}

export const itemKey = (listingId: string, listingVariantId: string | null) => `${listingId}:${listingVariantId ?? ""}`

const STEPS: { title: string; fields: FieldPath<OrderFormInput>[] }[] = [
  { title: "Customer", fields: ["customerName", "customerEmail", "customerPhone"] },
  { title: "Items", fields: ["items"] },
  {
    title: "Delivery",
    fields: ["shippingMethod", "shippingName", "shippingPhone", "shippingLine1", "shippingLine2", "shippingRegion", "shippingTown", "shippingGhs", "notes"],
  },
  { title: "Review", fields: ["discountType", "discountValue", "discountReason"] },
]

const DEFAULT_VALUES: OrderFormInput = {
  customerUserId: null,
  customerName: "",
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

export default function CreateOrderForm({ storeId }: { storeId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [chosen, setChosen] = useState<Record<string, ChosenItem>>({})
  // The looked-up customer, whose saved addresses the delivery step offers
  const [customer, setCustomer] = useState<OrderCustomer | null>(null)

  const form = useForm<OrderFormInput, unknown, OrderFormOutput>({
    resolver: zodResolver(createStoreOrderFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const isLast = step === STEPS.length - 1

  // Each step checks only its own fields before moving on
  const goNext = async () => {
    if (await form.trigger(STEPS[step]!.fields)) setStep(step + 1)
  }

  const onSubmit: SubmitHandler<OrderFormOutput> = (values) => {
    startTransition(async () => {
      const response = await createStoreOrderAction({ ...values, storeId })

      if (!response.success) {
        toast.add({ title: "Unable to create the order", description: response.error, type: "error" })
        // A line that sold out or went off sale is fixed on the items step
        if (response.code === "ITEM_UNAVAILABLE" || response.code === "INSUFFICIENT_STOCK") setStep(1)
        return
      }

      toast.add({ title: "Order created", description: `${response.data.reference} is waiting to be confirmed.`, type: "success" })
      router.push(`/store/orders/${response.data.id}/details`)
    })
  }

  return (
    <form
      onSubmit={(e) => {
        // Enter in a field moves to the next step rather than creating the order early
        if (!isLast) {
          e.preventDefault()
          void goNext()
          return
        }
        form.handleSubmit(onSubmit)(e)
      }}
      className="grid gap-6"
    >
      <ol className="flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((item, index) => (
          <li key={item.title}>
            <button
              type="button"
              // Back to any step already passed; forward only with Next, which checks the step
              disabled={index > step || isPending}
              onClick={() => setStep(index)}
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
                index === step ? "border-primary bg-primary text-primary-foreground" : index < step ? "hover:bg-accent" : "text-muted-foreground"
              )}
            >
              <span className="font-mono text-xs">{index + 1}</span>
              {item.title}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && <CustomerStep storeId={storeId} form={form} customer={customer} onCustomerChange={setCustomer} />}
      {step === 1 && <ItemsStep storeId={storeId} form={form} chosen={chosen} onChosenChange={setChosen} />}
      {step === 2 && <DeliveryStep form={form} customer={customer} />}
      {step === 3 && <ReviewStep storeId={storeId} form={form} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/store/orders" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={isPending}>
              Back
            </Button>
          )}
          {isLast ? (
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : "Create order"}
            </Button>
          ) : (
            <Button type="button" onClick={() => void goNext()} disabled={isPending}>
              Next
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
