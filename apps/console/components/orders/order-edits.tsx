"use client"

import { useMemo } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { GEODATA } from "@workspace/contracts"
import { ComboboxField, PhoneField, TextareaField, TextInputField } from "@workspace/forms"
import { FieldGroup } from "@workspace/ui/components/field"
import { updateOrderCustomerAction, updateOrderDeliveryAction, updateOrderNotesAction } from "@/lib/actions/order.actions"
import { updateStoreOrderCustomerAction, updateStoreOrderDeliveryAction, updateStoreOrderNotesAction } from "@/lib/actions/store-order.actions"
import { orderCustomerFormSchema, orderDeliveryFormSchema, orderNotesFormSchema } from "@/lib/schemas/order.schemas"
import EditOrderDialog from "./edit-order-dialog"

// The edits a pending order allows. The delivery method and fee aren't among them: changing them would reprice it.

const regionOptions = GEODATA.map((region) => ({ label: region.name, value: region.name }))

interface OrderTarget {
  // The store whose page this is, or null on the platform's pages
  storeId: string | null
  orderId: string
}

export function EditOrderCustomer({ storeId, orderId, customer }: OrderTarget & { customer: { name: string; email: string | null; phone: string | null } }) {
  return (
    <EditOrderDialog
      storeId={storeId}
      label="Edit customer"
      title="Edit customer"
      description="The details on this order. A linked account isn't changed."
      schema={orderCustomerFormSchema}
      values={{ customerName: customer.name, customerEmail: customer.email ?? "", customerPhone: customer.phone ?? "" }}
      save={(values) => (storeId ? updateStoreOrderCustomerAction({ ...values, storeId, orderId }) : updateOrderCustomerAction({ ...values, orderId }))}
    >
      {(form, isPending) => (
        <FieldGroup>
          <TextInputField control={form.control} label="Name" name="customerName" disabled={isPending} />
          <TextInputField control={form.control} label="Email (optional)" name="customerEmail" type="email" disabled={isPending} />
          <PhoneField control={form.control} label="Phone (optional)" name="customerPhone" defaultCountry="GH" disabled={isPending} />
        </FieldGroup>
      )}
    </EditOrderDialog>
  )
}

type DeliveryValues = { shippingName: string; shippingPhone: string; shippingLine1: string; shippingLine2: string; shippingRegion: string; shippingTown: string }

// Its own component, so the town list can follow the chosen region
function DeliveryFields({ form, isPending }: { form: UseFormReturn<DeliveryValues>; isPending: boolean }) {
  const region = useWatch({ control: form.control, name: "shippingRegion" })
  const townOptions = useMemo(() => (GEODATA.find((item) => item.name === region)?.towns ?? []).map((town) => ({ label: town, value: town })), [region])

  return (
    <FieldGroup>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInputField control={form.control} label="Recipient" name="shippingName" disabled={isPending} />
        <PhoneField control={form.control} label="Recipient's phone" name="shippingPhone" defaultCountry="GH" disabled={isPending} />
      </div>
      <TextInputField control={form.control} label="Address" name="shippingLine1" disabled={isPending} />
      <TextInputField control={form.control} label="More address details (optional)" name="shippingLine2" disabled={isPending} />
      <div className="grid gap-5 sm:grid-cols-2">
        <ComboboxField
          control={form.control}
          label="Region"
          name="shippingRegion"
          options={regionOptions}
          disabled={isPending}
          modal
          onValueChange={(value) => value !== region && form.setValue("shippingTown", "")}
        />
        <ComboboxField control={form.control} label="Town" name="shippingTown" options={townOptions} disabled={isPending || !region} modal />
      </div>
    </FieldGroup>
  )
}

export function EditOrderDelivery({
  storeId,
  orderId,
  shipping,
}: OrderTarget & { shipping: { name: string | null; phone: string | null; line1: string | null; line2: string | null; region: string | null; town: string | null } }) {
  return (
    <EditOrderDialog
      storeId={storeId}
      label="Edit delivery address"
      title="Edit delivery address"
      description="Where the order goes. The shipping fee stays as it is."
      schema={orderDeliveryFormSchema}
      values={{
        shippingName: shipping.name ?? "",
        shippingPhone: shipping.phone ?? "",
        shippingLine1: shipping.line1 ?? "",
        shippingLine2: shipping.line2 ?? "",
        shippingRegion: shipping.region ?? "",
        shippingTown: shipping.town ?? "",
      }}
      save={(values) => (storeId ? updateStoreOrderDeliveryAction({ ...values, storeId, orderId }) : updateOrderDeliveryAction({ ...values, orderId }))}
    >
      {(form, isPending) => <DeliveryFields form={form} isPending={isPending} />}
    </EditOrderDialog>
  )
}

export function EditOrderNotes({ storeId, orderId, notes }: OrderTarget & { notes: string | null }) {
  return (
    <EditOrderDialog
      storeId={storeId}
      label={notes ? "Edit notes" : "Add notes"}
      title="Order notes"
      description="For staff, not the customer."
      schema={orderNotesFormSchema}
      values={{ notes: notes ?? "" }}
      save={(values) => (storeId ? updateStoreOrderNotesAction({ ...values, storeId, orderId }) : updateOrderNotesAction({ ...values, orderId }))}
    >
      {(form, isPending) => <TextareaField control={form.control} name="notes" aria-label="Notes" disabled={isPending} />}
    </EditOrderDialog>
  )
}
