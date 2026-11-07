"use client"

import { useEffect, useRef } from "react"
import { useWatch } from "react-hook-form"
import { findDeliveryRate } from "@workspace/commerce/delivery-rates"
import { ShippingMethod } from "@workspace/db/enums"
import { SelectField } from "@workspace/forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import type { DeliverySettingsView } from "@/lib/data/delivery.data"
import { asStaffSaleForm, type StaffSaleFields, type StaffSaleForm } from "./form"

interface PickupChoiceProps<T extends StaffSaleFields, O> {
  form: StaffSaleForm<T, O>
  // The platform's delivery fees (Settings → Delivery), for going back to delivery
  delivery: DeliverySettingsView
  // The stores the items come from: one store's can be picked up there
  storeNames: string[]
}

// Delivery, or pickup when every item comes from one store and none is installed; the server checks both again
export default function PickupChoice<T extends StaffSaleFields, O>({ form: wizardForm, delivery, storeNames }: PickupChoiceProps<T, O>) {
  const form = asStaffSaleForm(wizardForm)
  const method = useWatch({ control: form.control, name: "shippingMethod" })
  const items = useWatch({ control: form.control, name: "items" })
  const isDelivery = method === ShippingMethod.DELIVERY
  const hasInstallation = items.some((item) => item.installation)
  const pickupStore = storeNames.length === 1 && !hasInstallation ? storeNames[0] : undefined
  const options = [{ label: "Delivery", value: ShippingMethod.DELIVERY }, ...(pickupStore ? [{ label: `Pickup from ${pickupStore}`, value: ShippingMethod.PICKUP }] : [])]

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
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Delivery or pickup</CardTitle>
        <CardDescription>How the customer gets the order.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <SelectField control={form.control} label="Method" name="shippingMethod" options={options} />
          {storeNames.length > 1 && <p className="text-sm text-muted-foreground">{`Pickup isn't available: the items come from ${storeNames.join(", ")}.`}</p>}
          {storeNames.length === 1 && hasInstallation && <p className="text-sm text-muted-foreground">Pickup isn&apos;t available for items being installed.</p>}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
