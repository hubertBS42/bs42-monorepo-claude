"use client"

import type { UseFormReturn } from "react-hook-form"
import type { InstallationAreaRow } from "@workspace/commerce/installation-areas"
import { NumberInputField, TextareaField } from "@workspace/forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import DeliveryAddressCard from "@/components/staff-sales/delivery-address-card"
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
}

export default function DeliveryStep({ form, customer, delivery, installationAreas }: DeliveryStepProps) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <DeliveryAddressCard kind="quote" form={form} customer={customer} delivery={delivery} installationAreas={installationAreas} />

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
