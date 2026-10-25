"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { FieldPath, SubmitHandler, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import type { InstallationAreaRow } from "@workspace/commerce/installation-areas"
import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { PaymentMethod } from "@workspace/db/enums"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"
import CustomerStep from "@/components/staff-sales/customer-step"
import { unlinkCustomer } from "@/components/staff-sales/form"
import ItemsStep from "@/components/staff-sales/items-step"
import ReviewStep from "@/components/staff-sales/review-step"
import { createOrderAction } from "@/lib/actions/order.actions"
import type { DeliverySettingsView } from "@/lib/data/delivery.data"
import { createOrderFormSchema } from "@/lib/schemas/order.schemas"
import type { ChosenQuoteItem, QuoteCustomer, QuotePreview } from "@/types"
import DeliveryStep from "./steps/delivery-step"
import { useRevalidateOnChange } from "@workspace/forms/use-revalidate-on-change"

export type CreateOrderInput = z.input<typeof createOrderFormSchema>
export type CreateOrderOutput = z.output<typeof createOrderFormSchema>

const STEPS: { title: string; fields: FieldPath<CreateOrderInput>[] }[] = [
  { title: "Customer", fields: ["customerName", "customerEmail", "customerPhone"] },
  { title: "Items", fields: ["items"] },
  { title: "Delivery and payment", fields: ["shippingName", "shippingPhone", "shippingLine1", "shippingLine2", "shippingRegion", "shippingTown", "shippingGhs", "paymentMethod", "notes"] },
  { title: "Review", fields: ["discountType", "discountValue", "discountReason"] },
]

interface CreateOrderFormProps {
  // The platform's delivery fees and installation areas, which the delivery step fills in from and warns against
  delivery: DeliverySettingsView
  installationAreas: InstallationAreaRow[]
}

export default function CreateOrderForm({ delivery, installationAreas }: CreateOrderFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [chosen, setChosen] = useState<Record<string, ChosenQuoteItem>>({})
  // The looked-up customer, whose saved addresses the delivery step offers
  const [customer, setCustomer] = useState<QuoteCustomer | null>(null)
  // The review step's prices, null while it prices them again: the order is created only at the total staff saw
  const [preview, setPreview] = useState<QuotePreview | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  // The recipient as last filled in from the customer, so a change of customer can follow until staff change it
  const recipientFromCustomer = useRef({ name: "", phone: "" })

  const form = useForm<CreateOrderInput, unknown, CreateOrderOutput>({
    resolver: zodResolver(createOrderFormSchema),
    defaultValues: {
      customerUserId: null,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      items: [],
      shippingName: "",
      shippingPhone: "",
      shippingLine1: "",
      shippingLine2: "",
      shippingRegion: "",
      shippingTown: "",
      shippingGhs: 0,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "",
      discountType: "NONE",
      discountValue: 0,
      discountReason: "",
    },
  })
  useRevalidateOnChange(form)
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" })

  const isLast = step === STEPS.length - 1

  // Each step checks only its own fields before moving on
  const goNext = async () => {
    if (!(await form.trigger(STEPS[step]!.fields))) return
    // The customer usually receives it themselves: the recipient follows them, until staff type another one or
    // choose a saved address
    if (step === 1) {
      const { customerName, customerPhone, shippingName, shippingPhone } = form.getValues()
      const filled = recipientFromCustomer.current
      if (shippingName === filled.name) form.setValue("shippingName", customerName)
      if (shippingPhone === filled.phone) form.setValue("shippingPhone", customerPhone)
      recipientFromCustomer.current = { name: customerName, phone: customerPhone }
    }
    setStep(step + 1)
  }

  const onSubmit: SubmitHandler<CreateOrderOutput> = (values) => {
    if (!preview) return
    startTransition(async () => {
      const response = await createOrderAction({ ...values, expectedTotalGhs: preview.totalGhs })

      if (!response.success) {
        toast.add({ title: "Unable to create the order", description: response.error, type: "error" })
        // A line that went off sale, ran out or stopped offering installation, a town outside the installation areas,
        // or a customer whose account went: each is fixed on its step. New prices show on the review step.
        if (response.code === "ITEM_UNAVAILABLE" || response.code === "INSUFFICIENT_STOCK" || response.code === "NO_INSTALLATION") setStep(1)
        if (response.code === "OUTSIDE_INSTALLATION_AREAS") setStep(2)
        if (response.code === "CUSTOMER_NOT_FOUND") {
          setCustomer(null)
          unlinkCustomer(form)
          setStep(0)
        }
        if (response.code === "PRICE_CHANGED") setRefreshKey((key) => key + 1)
        return
      }

      toast.add({ title: "Order created", description: `${response.data.reference} is waiting for its payment.`, type: "success" })
      router.push(`/orders/${response.data.id}/details`)
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

      {step === 0 && <CustomerStep kind="order" form={form} customer={customer} onCustomerChange={setCustomer} />}
      {step === 1 && <ItemsStep kind="order" form={form} chosen={chosen} onChosenChange={setChosen} />}
      {step === 2 && <DeliveryStep form={form} customer={customer} delivery={delivery} installationAreas={installationAreas} />}
      {step === 3 && (
        <ReviewStep
          kind="order"
          form={form}
          customer={customer}
          terms={`Paying by ${PAYMENT_METHOD_LABELS[paymentMethod].toLowerCase()}`}
          freeDeliveryFromGhs={delivery.freeDeliveryFromGhs}
          onPreviewChange={setPreview}
          refreshKey={refreshKey}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/orders" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={isPending}>
              Back
            </Button>
          )}
          {/* Separate keys: reusing one element would turn the clicked Next into a submit button before
              the click's default action runs, so leaving the Delivery step would create the order */}
          {isLast ? (
            // Not until the total it will be created at is showing
            <Button key="submit" type="submit" disabled={isPending || !preview}>
              {isPending ? <Spinner /> : "Create order"}
            </Button>
          ) : (
            <Button key="next" type="button" onClick={() => void goNext()} disabled={isPending}>
              Next
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
