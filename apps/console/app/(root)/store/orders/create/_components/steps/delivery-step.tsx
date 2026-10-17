"use client"

import { useEffect, useMemo } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { GEODATA } from "@workspace/contracts"
import { ShippingMethod } from "@workspace/db/enums"
import { ComboboxField, NumberInputField, PhoneField, SelectField, TextareaField, TextInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import type { OrderCustomer } from "@/types"
import type { OrderFormInput, OrderFormOutput } from "../create-order-form"

const methodOptions = [
  { label: "Pickup from the store", value: ShippingMethod.PICKUP },
  { label: "Delivery", value: ShippingMethod.DELIVERY },
]
const regionOptions = GEODATA.map((region) => ({ label: region.name, value: region.name }))

interface DeliveryStepProps {
  form: UseFormReturn<OrderFormInput, unknown, OrderFormOutput>
  // The looked-up customer, whose saved addresses can fill the delivery in
  customer: OrderCustomer | null
}

export default function DeliveryStep({ form, customer }: DeliveryStepProps) {
  const method = useWatch({ control: form.control, name: "shippingMethod" })
  const region = useWatch({ control: form.control, name: "shippingRegion" })
  const townOptions = useMemo(() => (GEODATA.find((item) => item.name === region)?.towns ?? []).map((town) => ({ label: town, value: town })), [region])
  const isDelivery = method === ShippingMethod.DELIVERY

  // A pickup has no shipping fee
  useEffect(() => {
    if (!isDelivery) form.setValue("shippingGhs", 0)
  }, [isDelivery, form])

  const applyAddress = (address: OrderCustomer["addresses"][number]) => {
    const options = { shouldDirty: true }
    form.setValue("shippingName", address.name, options)
    form.setValue("shippingPhone", address.phone, options)
    form.setValue("shippingLine1", address.line1, options)
    form.setValue("shippingLine2", address.line2 ?? "", options)
    form.setValue("shippingRegion", address.region, options)
    form.setValue("shippingTown", address.town, options)
    form.clearErrors(["shippingName", "shippingPhone", "shippingLine1", "shippingRegion", "shippingTown"])
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>How the customer gets the order.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SelectField control={form.control} label="Method" name="shippingMethod" options={methodOptions} />

            {isDelivery && (
              <>
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
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextInputField control={form.control} label="Recipient" name="shippingName" />
                  <PhoneField control={form.control} label="Recipient's phone" name="shippingPhone" defaultCountry="GH" />
                </div>
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
                  <NumberInputField control={form.control} label="Shipping fee" name="shippingGhs" step={0.01} min={0} prependText="GH₵" />
                </div>
              </>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>For the store, not the customer.</CardDescription>
        </CardHeader>
        <CardContent>
          <TextareaField control={form.control} name="notes" aria-label="Notes" placeholder="Anything to remember about this order" />
        </CardContent>
      </Card>
    </div>
  )
}
