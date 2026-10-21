"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import ComboboxField from "@workspace/forms/components/combobox-field"
import PhoneField from "@workspace/forms/components/phone-field"
import SwitchField from "@workspace/forms/components/switch-field"
import TextInputField from "@workspace/forms/components/text-input-field"
import { GEODATA } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { FieldError } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { saveAddressAction } from "@/lib/actions/account.actions"
import { addressSchema, type AddressValues } from "@/lib/schemas/address.schemas"

const REGION_OPTIONS = GEODATA.map((region) => ({ label: region.name, value: region.name }))

// Adds a saved address, or edits one (`id`). Any town can be saved; checkout offers only the ones it delivers to.
export function AddressForm({ id, initial, isOnlyDefault }: { id?: string; initial: AddressValues; isOnlyDefault?: boolean }) {
  const router = useRouter()
  const form = useForm<AddressValues>({ resolver: zodResolver(addressSchema), defaultValues: initial })
  const region = useWatch({ control: form.control, name: "region" })
  const townOptions = useMemo(() => (GEODATA.find((item) => item.name === region)?.towns ?? []).map((name) => ({ label: name, value: name })), [region])
  const { isSubmitting } = form.formState

  async function onSubmit(values: AddressValues) {
    form.clearErrors("root")
    try {
      const result = await saveAddressAction(values, id)
      if (!result.success) {
        form.setError("root", { message: result.error })
        if (result.code === "UNAUTHORIZED") router.refresh()
        return
      }
      toast.add({ title: id ? "Address updated" : "Address saved", type: "success" })
      router.push("/account/addresses")
      router.refresh()
    } catch (error) {
      console.error("Saving an address failed:", error)
      form.setError("root", { message: "We couldn't save that just now. Please try again." })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <TextInputField control={form.control} name="name" label="Full name" autoComplete="name" disabled={isSubmitting} />
      <PhoneField control={form.control} name="phone" label="Phone" defaultCountry="GH" disabled={isSubmitting} />
      <div className="sm:col-span-2">
        <TextInputField control={form.control} name="line1" label="Address" placeholder="House number and street, or a landmark" autoComplete="address-line1" disabled={isSubmitting} />
      </div>
      <div className="sm:col-span-2">
        <TextInputField
          control={form.control}
          name="line2"
          label="More details (optional)"
          placeholder="Area, digital address (GhanaPost GPS), directions"
          autoComplete="address-line2"
          disabled={isSubmitting}
        />
      </div>
      <ComboboxField
        control={form.control}
        name="region"
        label="Region"
        options={REGION_OPTIONS}
        placeholder="Select a region"
        disabled={isSubmitting}
        onValueChange={(next) => {
          if (next !== region) form.setValue("town", "")
        }}
      />
      <ComboboxField control={form.control} name="town" label="Town" options={townOptions} placeholder="Select a town" disabled={isSubmitting || !region} />
      <div className="sm:col-span-2">
        {/* The default can't be unset here: choosing another address takes it */}
        <SwitchField
          control={form.control}
          name="isDefault"
          label="Use as my default address"
          description={isOnlyDefault ? "This is your default address. Make another the default to change it." : "Checkout fills it in for you."}
          disabled={isSubmitting || isOnlyDefault}
        />
      </div>
      {form.formState.errors.root && (
        <div className="sm:col-span-2">
          <FieldError errors={[form.formState.errors.root]} />
        </div>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {id ? "Save changes" : "Save address"}
        </Button>
        <Button render={<Link href="/account/addresses" />} variant="outline">
          Cancel
        </Button>
      </div>
    </form>
  )
}
