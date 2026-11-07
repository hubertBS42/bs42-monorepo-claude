"use client"

import { useEffect, useRef } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { findDeliveryRate } from "@workspace/commerce/delivery-rates"
import type { InstallationAreaRow } from "@workspace/commerce/installation-areas"
import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { ShippingMethod } from "@workspace/db/enums"
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
  // The stores the items come from: one store's can be picked up there
  storeNames: string[]
}

export default function DeliveryStep({ form, customer, delivery, installationAreas, storeNames }: DeliveryStepProps) {
  const method = useWatch({ control: form.control, name: "shippingMethod" })
  const items = useWatch({ control: form.control, name: "items" })
  const isDelivery = method === ShippingMethod.DELIVERY
  const hasInstallation = items.some((item) => item.installation)
  const pickupStore = storeNames.length === 1 && !hasInstallation ? storeNames[0] : undefined
  const methodOptions = [{ label: "Delivery", value: ShippingMethod.DELIVERY }, ...(pickupStore ? [{ label: `Pickup from ${pickupStore}`, value: ShippingMethod.PICKUP }] : [])]

  // The items may have changed since pickup was chosen
  useEffect(() => {
    if (!isDelivery && !pickupStore) form.setValue("shippingMethod", ShippingMethod.DELIVERY)
  }, [isDelivery, pickupStore, form])

  // A pickup has no fee; going back to delivery takes the address's again
  const wasPickup = useRef(!isDelivery)
  useEffect(() => {
    if (!isDelivery) form.setValue("shippingGhs", 0)
    else if (wasPickup.current) {
      const { shippingRegion, shippingTown } = form.getValues()
      const rate = shippingRegion ? findDeliveryRate(delivery.rates, shippingRegion, shippingTown) : undefined
      if (rate) form.setValue("shippingGhs", Number(rate.feeGhs))
    }
    wasPickup.current = !isDelivery
  }, [isDelivery, delivery.rates, form])

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Delivery or pickup</CardTitle>
          <CardDescription>How the customer gets the order.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SelectField control={form.control} label="Method" name="shippingMethod" options={methodOptions} />
            {storeNames.length > 1 && <p className="text-sm text-muted-foreground">{`Pickup isn't available: the items come from ${storeNames.join(", ")}.`}</p>}
            {storeNames.length === 1 && hasInstallation && <p className="text-sm text-muted-foreground">Pickup isn&apos;t available for items being installed.</p>}
          </FieldGroup>
        </CardContent>
      </Card>

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

      {isDelivery && (
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
