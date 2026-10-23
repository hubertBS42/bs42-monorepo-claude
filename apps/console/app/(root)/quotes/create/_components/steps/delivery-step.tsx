"use client"

import { useEffect, useMemo, useRef } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { findDeliveryRate } from "@workspace/commerce/delivery-rates"
import { installsIn, type InstallationAreaRow } from "@workspace/commerce/installation-areas"
import { GEODATA } from "@workspace/contracts"
import { ComboboxField, NumberInputField, TextareaField, TextInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import type { DeliverySettingsView } from "@/lib/data/delivery.data"
import { MAX_QUOTE_VALIDITY_DAYS } from "@/lib/schemas/quote.schemas"
import type { QuoteCustomer } from "@/types"
import type { QuoteFormInput, QuoteFormOutput } from "../quote-form"

const regionOptions = GEODATA.map((region) => ({ label: region.name, value: region.name }))

interface DeliveryStepProps {
  form: UseFormReturn<QuoteFormInput, unknown, QuoteFormOutput>
  // The looked-up customer, whose saved addresses can fill the delivery in
  customer: QuoteCustomer | null
  // The platform's delivery fees (Settings → Delivery) and installation areas (Settings → Installation)
  delivery: DeliverySettingsView
  installationAreas: InstallationAreaRow[]
}

export default function DeliveryStep({ form, customer, delivery, installationAreas }: DeliveryStepProps) {
  const region = useWatch({ control: form.control, name: "shippingRegion" })
  const town = useWatch({ control: form.control, name: "shippingTown" })
  const items = useWatch({ control: form.control, name: "items" })
  const townOptions = useMemo(() => (GEODATA.find((item) => item.name === region)?.towns ?? []).map((town) => ({ label: town, value: town })), [region])

  // The fee for the address: its town's, else its region's
  const rate = region ? findDeliveryRate(delivery.rates, region, town) : undefined
  // Installation is only done in Settings' areas, which the server checks again
  const noInstallation = !!region && !!town && (items ?? []).some((item) => item.installation) && !installsIn(installationAreas, region, town)

  // Choosing another area fills its fee in; staff can still change it. Only on a change, not when the step opens
  // again, so a fee typed by hand survives going back and forth between steps.
  const area = `${region}|${town}`
  const shownArea = useRef(area)
  useEffect(() => {
    if (shownArea.current === area) return
    shownArea.current = area
    if (rate) form.setValue("shippingGhs", Number(rate.feeGhs), { shouldDirty: true })
  }, [area, rate, form])

  const applyAddress = (address: QuoteCustomer["addresses"][number]) => {
    const options = { shouldDirty: true }
    form.setValue("shippingLine1", address.line1, options)
    form.setValue("shippingLine2", address.line2 ?? "", options)
    form.setValue("shippingRegion", address.region, options)
    form.setValue("shippingTown", address.town, options)
    form.clearErrors(["shippingLine1", "shippingRegion", "shippingTown"])
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>Where the order would go. Quotations are for delivery, to the customer.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {customer && customer.addresses.length > 0 && (
              <div className="grid gap-2">
                <p className="text-sm font-medium">Saved addresses</p>
                <div className="flex flex-wrap gap-2">
                  {customer.addresses.map((address) => (
                    <Button key={address.id} type="button" variant="outline" size="sm" onClick={() => applyAddress(address)}>
                      {`${address.line1}, ${address.town}${address.isDefault ? " (default)" : ""}`}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <TextInputField control={form.control} label="Address" name="shippingLine1" />
            <TextInputField control={form.control} label="More address details (optional)" name="shippingLine2" />
            <div className="grid gap-5 sm:grid-cols-2">
              <ComboboxField
                control={form.control}
                label="Region"
                name="shippingRegion"
                options={regionOptions}
                placeholder="Select a region"
                // A town belongs to its region
                onValueChange={(value) => value !== region && form.setValue("shippingTown", "")}
              />
              <ComboboxField control={form.control} label="Town" name="shippingTown" options={townOptions} placeholder="Select a town" disabled={!region} />
            </div>
            <div className="max-w-56">
              <NumberInputField control={form.control} label="Delivery fee" name="shippingGhs" step={0.01} min={0} prependText="GH₵" />
            </div>
            {region && (
              <p className="text-sm text-muted-foreground">
                {rate ? `The delivery fee for ${rate.town ?? region} is GH₵${rate.feeGhs}.` : `There's no delivery fee set for ${town || region}, so set what delivering there costs.`}
                {delivery.freeDeliveryFromGhs !== null && ` Orders of GH₵${delivery.freeDeliveryFromGhs} or more after any discount deliver free, so set 0 if this one does.`}
              </p>
            )}
            {noInstallation && <p className="text-sm text-destructive">{`We don't install in ${town}. Take installation off the items, or choose another address.`}</p>}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terms</CardTitle>
          <CardDescription>Printed on the quotation.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <NumberInputField
              control={form.control}
              label="Prices hold for (days)"
              name="validityDays"
              step={1}
              min={1}
              max={MAX_QUOTE_VALIDITY_DAYS}
              description="Until the end of the day this many days from today."
            />
            <TextareaField control={form.control} label="Note to the customer (optional)" name="notes" placeholder="Lead times, what's included, site visit…" rows={4} />
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}
