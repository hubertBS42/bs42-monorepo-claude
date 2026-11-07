"use client"

import { useWatch, type UseFormReturn } from "react-hook-form"
import type { InstallationAreaRow } from "@workspace/commerce/installation-areas"
import { ShippingMethod } from "@workspace/db/enums"
import { NumberInputField, TextareaField } from "@workspace/forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import DeliveryAddressCard from "@/components/staff-sales/delivery-address-card"
import PickupChoice from "@/components/staff-sales/pickup-choice"
import type { DeliverySettingsView } from "@/lib/data/delivery.data"
import { MAX_QUOTE_VALIDITY_DAYS } from "@/lib/schemas/quote.schemas"
import type { QuoteCustomer } from "@/types"
import type { QuoteFormInput, QuoteFormOutput } from "../quote-form"

interface DeliveryStepProps {
  form: UseFormReturn<QuoteFormInput, unknown, QuoteFormOutput>
  // The looked-up customer, whose saved addresses can fill the delivery in
  customer: QuoteCustomer | null
  // The platform's delivery fees (Settings → Delivery) and installation areas (also Settings → Delivery)
  delivery: DeliverySettingsView
  installationAreas: InstallationAreaRow[]
  // The stores the items come from: one store's can be picked up at its pickup location
  stores: { id: string; name: string }[]
  pickupLocations: Record<string, string>
}

export default function DeliveryStep({ form, customer, delivery, installationAreas, stores, pickupLocations }: DeliveryStepProps) {
  const method = useWatch({ control: form.control, name: "shippingMethod" })

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <PickupChoice form={form} delivery={delivery} stores={stores} pickupLocations={pickupLocations} />

      <Card className="lg:row-span-2">
        <CardHeader>
          <CardTitle>Terms</CardTitle>
          <CardDescription>Printed on the quotation.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <NumberInputField control={form.control} label="Prices hold for (days)" name="validityDays" step={1} min={1} max={MAX_QUOTE_VALIDITY_DAYS} />
            <TextareaField control={form.control} label="Note to the customer (optional)" name="notes" placeholder="Lead times, what's included, site visit…" rows={4} />
          </FieldGroup>
        </CardContent>
      </Card>

      {method === ShippingMethod.DELIVERY && <DeliveryAddressCard kind="quote" form={form} customer={customer} delivery={delivery} installationAreas={installationAreas} />}
    </div>
  )
}
