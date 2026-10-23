"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { FieldPath, SubmitHandler, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import type { InstallationAreaRow } from "@workspace/commerce/installation-areas"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"
import { createQuoteAction } from "@/lib/actions/quote.actions"
import type { DeliverySettingsView } from "@/lib/data/delivery.data"
import { createQuoteFormSchema } from "@/lib/schemas/quote.schemas"
import type { ChosenQuoteItem, QuoteCopy, QuoteCustomer } from "@/types"
import CustomerStep from "@/components/staff-sales/customer-step"
import { unlinkCustomer } from "@/components/staff-sales/form"
import ItemsStep from "@/components/staff-sales/items-step"
import ReviewStep from "@/components/staff-sales/review-step"
import DeliveryStep from "./steps/delivery-step"

export type QuoteFormInput = z.input<typeof createQuoteFormSchema>
export type QuoteFormOutput = z.output<typeof createQuoteFormSchema>

const STEPS: { title: string; fields: FieldPath<QuoteFormInput>[] }[] = [
  { title: "Customer", fields: ["customerName", "customerEmail", "customerPhone"] },
  { title: "Items", fields: ["items"] },
  { title: "Delivery and terms", fields: ["shippingLine1", "shippingLine2", "shippingRegion", "shippingTown", "shippingGhs", "validityDays", "notes"] },
  { title: "Review", fields: ["discountType", "discountValue", "discountReason"] },
]

interface QuoteFormProps {
  // The platform's delivery fees and installation areas, which the delivery step fills in from and warns against
  delivery: DeliverySettingsView
  installationAreas: InstallationAreaRow[]
  // Settings' default validity
  validityDays: number
  // "Copy to a new quotation": the quote's details to start from
  copy: QuoteCopy | null
}

export default function QuoteForm({ delivery, installationAreas, validityDays, copy }: QuoteFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [chosen, setChosen] = useState<Record<string, ChosenQuoteItem>>(copy?.chosen ?? {})
  // The looked-up customer, whose saved addresses the delivery step offers
  const [customer, setCustomer] = useState<QuoteCustomer | null>(copy?.customer ?? null)

  const form = useForm<QuoteFormInput, unknown, QuoteFormOutput>({
    resolver: zodResolver(createQuoteFormSchema),
    defaultValues: copy
      ? { ...copy.values, validityDays }
      : {
          customerUserId: null,
          customerName: "",
          customerEmail: "",
          customerPhone: "",
          items: [],
          shippingLine1: "",
          shippingLine2: "",
          shippingRegion: "",
          shippingTown: "",
          shippingGhs: 0,
          validityDays,
          notes: "",
          discountType: "NONE",
          discountValue: 0,
          discountReason: "",
        },
  })

  const isLast = step === STEPS.length - 1
  const validity = useWatch({ control: form.control, name: "validityDays" })

  // Each step checks only its own fields before moving on
  const goNext = async () => {
    if (await form.trigger(STEPS[step]!.fields)) setStep(step + 1)
  }

  const onSubmit: SubmitHandler<QuoteFormOutput> = (values) => {
    startTransition(async () => {
      const response = await createQuoteAction(values)

      if (!response.success) {
        toast.add({ title: "Unable to make the quotation", description: response.error, type: "error" })
        // A line that went off sale or stopped offering installation, a town outside the installation areas, or a
        // customer whose account went: each is fixed on its step
        if (response.code === "ITEM_UNAVAILABLE" || response.code === "NO_INSTALLATION") setStep(1)
        if (response.code === "OUTSIDE_INSTALLATION_AREAS") setStep(2)
        if (response.code === "CUSTOMER_NOT_FOUND") {
          setCustomer(null)
          unlinkCustomer(form)
          setStep(0)
        }
        return
      }

      toast.add({ title: "Quotation sent", description: `${response.data.reference} is on its way to ${values.customerEmail}.`, type: "success" })
      router.push(`/quotes/${response.data.id}`)
    })
  }

  return (
    <form
      onSubmit={(e) => {
        // Enter in a field moves to the next step rather than sending the quotation early
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

      {step === 0 && <CustomerStep kind="quote" form={form} customer={customer} onCustomerChange={setCustomer} />}
      {step === 1 && <ItemsStep kind="quote" form={form} chosen={chosen} onChosenChange={setChosen} />}
      {step === 2 && <DeliveryStep form={form} customer={customer} delivery={delivery} installationAreas={installationAreas} />}
      {step === 3 && (
        <ReviewStep kind="quote" form={form} customer={customer} terms={`Prices hold for ${validity} ${validity === 1 ? "day" : "days"}`} freeDeliveryFromGhs={delivery.freeDeliveryFromGhs} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/quotes" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={isPending}>
              Back
            </Button>
          )}
          {/* Separate keys: reusing one element would turn the clicked Next into a submit button before
              the click's default action runs, so leaving the Delivery step would send the quotation */}
          {isLast ? (
            <Button key="submit" type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : "Send quotation"}
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
