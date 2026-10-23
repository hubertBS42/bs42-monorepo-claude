"use client"

import type { UseFormReturn } from "react-hook-form"
import type { InstallationAreaRow } from "@workspace/commerce/installation-areas"
import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { PhoneField, SelectField, TextareaField, TextInputField } from "@workspace/forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import DeliveryAddressCard from "@/components/staff-sales/delivery-address-card"
import type { DeliverySettingsView } from "@/lib/data/delivery.data"
import { STAFF_ORDER_PAYMENT_METHODS } from "@/lib/schemas/order.schemas"
import type { QuoteCustomer } from "@/types"
import type { CreateOrderInput, CreateOrderOutput } from "../create-order-form"

const paymentOptions = STAFF_ORDER_PAYMENT_METHODS.map((method) => ({ label: PAYMENT_METHOD_LABELS[method], value: method }))

interface DeliveryStepProps {
  form: UseFormReturn<CreateOrderInput, unknown, CreateOrderOutput>
  // The looked-up customer, whose saved addresses can fill the delivery in
  customer: QuoteCustomer | null
  // The platform's delivery fees (Settings → Delivery) and installation areas (also Settings → Delivery)
  delivery: DeliverySettingsView
  installationAreas: InstallationAreaRow[]
}

export default function DeliveryStep({ form, customer, delivery, installationAreas }: DeliveryStepProps) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <DeliveryAddressCard
        kind="order"
        form={form}
        customer={customer}
        delivery={delivery}
        installationAreas={installationAreas}
        onAddressApplied={(address) => {
          form.setValue("shippingName", address.name, { shouldDirty: true })
          form.setValue("shippingPhone", address.phone, { shouldDirty: true })
          form.clearErrors(["shippingName", "shippingPhone"])
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInputField control={form.control} label="Recipient" name="shippingName" />
          <PhoneField control={form.control} label="Recipient's phone" name="shippingPhone" defaultCountry="GH" />
        </div>
      </DeliveryAddressCard>

      <Card>
        <CardHeader>
          <CardTitle>Payment and notes</CardTitle>
          <CardDescription>The order starts unpaid. Record the payment on its page when it arrives.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SelectField control={form.control} label="The customer will pay by" name="paymentMethod" options={paymentOptions} />
            <TextareaField control={form.control} label="Notes (optional)" name="notes" placeholder="For staff, not the customer" rows={4} />
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}
