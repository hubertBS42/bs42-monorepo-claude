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

import type { PickupOption } from "@workspace/commerce/pickup-locations"
import type { DeliveryArea } from "@/components/checkout/checkout-form"
import { FulfilmentChoice, PickupAddress, rememberedLocation } from "@/components/checkout/fulfilment-choice"
import { createQuoteAction } from "@/lib/actions/quote.actions"
import { quoteRequestSchema, type QuoteRequestValues } from "@/lib/schemas/quote.schemas"
import { useRevalidateOnChange } from "@workspace/forms/use-revalidate-on-change"

// "Get a quote" under the basket's summary: who it's addressed to and where it would be delivered (the fee is part of
// the quote), then the quote's page. A signed-out visitor is sent to sign in first, and back to the basket. `primary`
// makes it the basket's main button, while online payments are off and there's no checkout. `deliveryToConfirm`: no
// delivery fees are set, so the quote leaves delivery out for staff to confirm.
export function QuoteRequestDialog({
  signedIn,
  initial,
  areas,
  validityDays,
  deliveryToConfirm,
  pickupOptions,
  primary = false,
}: {
  signedIn: boolean
  initial: QuoteRequestValues
  areas: DeliveryArea[]
  validityDays: number
  deliveryToConfirm: boolean
  // Where the basket can be collected, if anywhere
  pickupOptions: PickupOption[]
  primary?: boolean
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<QuoteRequestValues>({ resolver: zodResolver(quoteRequestSchema), defaultValues: initial })
  useRevalidateOnChange(form)
  const region = useWatch({ control: form.control, name: "region" })
  const method = useWatch({ control: form.control, name: "method" })
  const pickupLocationId = useWatch({ control: form.control, name: "pickupLocationId" })
  const pickup = method === "PICKUP" ? pickupOptions.find((option) => option.id === pickupLocationId) : undefined
  const isPickup = !!pickup
  const regionOptions = useMemo(() => areas.map((area) => ({ label: area.region, value: area.region })), [areas])
  const townOptions = useMemo(() => (areas.find((area) => area.region === region)?.towns ?? []).map((name) => ({ label: name, value: name })), [areas, region])
  const { isSubmitting } = form.formState

  if (!signedIn) {
    return (
      <Button render={<Link href="/sign-in?redirect=/basket" />} variant={primary ? "default" : "outline"} size={primary ? "lg" : "default"} className="w-full">
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // The location chosen last time, when the basket can still be collected there
        const remembered = next && form.getValues("method") === "DELIVERY" ? rememberedLocation(pickupOptions) : null
        if (remembered) {
          form.setValue("method", "PICKUP")
          form.setValue("pickupLocationId", remembered)
        }
        setOpen(next)
      }}
    >
      <DialogTrigger
        render={
          <Button variant={primary ? "default" : "outline"} size={primary ? "lg" : "default"} className="w-full">
            <FileText data-icon="inline-start" aria-hidden />
            Get a quote
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Get a quotation</DialogTitle>
          <DialogDescription>
            Prices hold for {validityDays} days. Items aren&apos;t reserved until you pay.{deliveryToConfirm && !isPickup && " We'll confirm the delivery fee with you."}
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
          {pickupOptions.length > 0 && (
            <div className="sm:col-span-2">
              <FulfilmentChoice
                value={pickup ? { method: "PICKUP", pickupLocationId: pickup.id } : { method: "DELIVERY" }}
                onChange={(next) => {
                  form.setValue("method", next.method)
                  form.setValue("pickupLocationId", next.method === "PICKUP" ? next.pickupLocationId : "")
                  form.clearErrors()
                }}
                options={pickupOptions}
                disabled={isSubmitting}
              />
            </div>
          )}
          <TextInputField control={form.control} name="name" label="Addressed to" autoComplete="name" disabled={isSubmitting} />
          <PhoneField control={form.control} name="phone" label="Phone" defaultCountry="GH" disabled={isSubmitting} />
          {pickup ? (
            <div className="sm:col-span-2">
              <PickupAddress pickup={pickup} />
            </div>
          ) : (
            <>
              <div className="sm:col-span-2">
                <TextInputField
                  control={form.control}
                  name="line1"
                  label="Delivery address"
                  placeholder="House number and street, or a landmark"
                  autoComplete="address-line1"
                  disabled={isSubmitting}
                />
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
            </>
          )}
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
