"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileText } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import ComboboxField from "@workspace/forms/components/combobox-field"
import PhoneField from "@workspace/forms/components/phone-field"
import TextInputField from "@workspace/forms/components/text-input-field"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { FieldError } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"

import type { DeliveryArea } from "@/components/checkout/checkout-form"
import { createQuoteAction } from "@/lib/actions/quote.actions"
import { quoteRequestSchema, type QuoteRequestValues } from "@/lib/schemas/quote.schemas"

// "Get a quote" under the basket's summary: who it's addressed to and where it would be delivered (the fee is part of
// the quote), then the quote's page. A signed-out visitor is sent to sign in first, and back to the basket.
export function QuoteRequestDialog({ signedIn, initial, areas, validityDays }: { signedIn: boolean; initial: QuoteRequestValues; areas: DeliveryArea[]; validityDays: number }) {
  const [open, setOpen] = useState(false)
  const form = useForm<QuoteRequestValues>({ resolver: zodResolver(quoteRequestSchema), defaultValues: initial })
  const region = useWatch({ control: form.control, name: "region" })
  const regionOptions = useMemo(() => areas.map((area) => ({ label: area.region, value: area.region })), [areas])
  const townOptions = useMemo(() => (areas.find((area) => area.region === region)?.towns ?? []).map((name) => ({ label: name, value: name })), [areas, region])
  const { isSubmitting } = form.formState

  if (!signedIn) {
    return (
      <Button render={<Link href="/sign-in?redirect=/basket" />} variant="outline" className="w-full">
        <FileText data-icon="inline-start" aria-hidden />
        Sign in to get a quote
      </Button>
    )
  }

  async function onSubmit(values: QuoteRequestValues) {
    form.clearErrors("root")
    const result = await createQuoteAction(values)
    if (!result.success) {
      form.setError("root", { message: result.error })
      return
    }
    // A full load: the quote's page is new, and the basket's count is unchanged
    window.location.assign(result.data.redirectTo)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="w-full">
            <FileText data-icon="inline-start" aria-hidden />
            Get a quote
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Get a quotation</DialogTitle>
          <DialogDescription>
            We&apos;ll price your basket with delivery to this address and hold the prices for {validityDays} days. Items aren&apos;t reserved until you accept and pay.
          </DialogDescription>
        </DialogHeader>
        {/* The dialog is portaled, but React events still bubble to any form it's rendered inside */}
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            void form.handleSubmit(onSubmit)(e)
          }}
          className="grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <TextInputField control={form.control} name="name" label="Addressed to" autoComplete="name" disabled={isSubmitting} />
          <PhoneField control={form.control} name="phone" label="Phone" defaultCountry="GH" disabled={isSubmitting} />
          <div className="sm:col-span-2">
            <TextInputField control={form.control} name="line1" label="Delivery address" placeholder="House number and street, or a landmark" autoComplete="address-line1" disabled={isSubmitting} />
          </div>
          <div className="sm:col-span-2">
            <TextInputField control={form.control} name="line2" label="More details (optional)" autoComplete="address-line2" disabled={isSubmitting} />
          </div>
          <ComboboxField
            control={form.control}
            name="region"
            label="Region"
            options={regionOptions}
            placeholder="Select a region"
            disabled={isSubmitting}
            onValueChange={(next) => {
              if (next !== region) form.setValue("town", "")
            }}
          />
          <ComboboxField control={form.control} name="town" label="Town" options={townOptions} placeholder="Select a town" disabled={isSubmitting || !region} />
          {form.formState.errors.root && (
            <div className="sm:col-span-2">
              <FieldError errors={[form.formState.errors.root]} />
            </div>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Back
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner data-icon="inline-start" />}
              Make the quotation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
