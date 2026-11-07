"use client"

import { useWatch, type UseFormReturn } from "react-hook-form"
import type { InstallationAreaRow } from "@workspace/commerce/installation-areas"
import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { ShippingMethod } from "@workspace/db/enums"
import { PhoneField, SelectField, TextareaField, TextInputField } from "@workspace/forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import DeliveryAddressCard from "@/components/staff-sales/delivery-address-card"
import PickupChoice from "@/components/staff-sales/pickup-choice"
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
  // The stores the items come from: one store's can be picked up there
  storeNames: string[]
}

export default function DeliveryStep({ form, customer, delivery, installationAreas, storeNames }: DeliveryStepProps) {
  const method = useWatch({ control: form.control, name: "shippingMethod" })

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <PickupChoice form={form} delivery={delivery} storeNames={storeNames} />

      <Card className="lg:row-span-2">
        <CardHeader>
          <CardTitle>Payment and notes</CardTitle>
          <CardDescription>Record the payment on the order once it arrives.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SelectField control={form.control} label="The customer will pay by" name="paymentMethod" options={paymentOptions} />
            <TextareaField control={form.control} label="Notes (optional)" name="notes" placeholder="For staff, not the customer" rows={4} />
          </FieldGroup>
        </CardContent>
      </Card>

      {method === ShippingMethod.DELIVERY && (
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
      )}
    </div>
  )
}
