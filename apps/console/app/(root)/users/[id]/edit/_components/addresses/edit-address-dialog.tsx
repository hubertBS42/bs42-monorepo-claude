"use client"
import { Button } from "@workspace/ui/components/button"
import { updateAddressAction } from "@/lib/actions/user.actions"
import { updateAddressFormSchema } from "@/lib/schemas/user.schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { Dispatch, SetStateAction, useMemo, useTransition } from "react"
import { SubmitHandler, useForm, useWatch } from "react-hook-form"
import { toast } from "@workspace/ui/components/toast"
import { z } from "zod"
import { GEODATA } from "@workspace/contracts"
import TextInputField from "@workspace/forms/components/text-input-field"
import PhoneField from "@workspace/forms/components/phone-field"
import SwitchField from "@workspace/forms/components/switch-field"
import ComboboxField from "@workspace/forms/components/combobox-field"
import { Spinner } from "@workspace/ui/components/spinner"
import { useRouter } from "next/navigation"
import type { Address } from "@workspace/db/client"
import { useRevalidateOnChange } from "@workspace/forms/use-revalidate-on-change"

const regionOptions = GEODATA.map((data) => ({ label: data.name, value: data.name }))

const EditAddressDialog = ({ address, setDialogIsOpen }: { address: Address; setDialogIsOpen: Dispatch<SetStateAction<boolean>> }) => {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const form = useForm<z.infer<typeof updateAddressFormSchema>>({
    resolver: zodResolver(updateAddressFormSchema),
    defaultValues: {
      id: address.id,
      name: address.name,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? "",
      region: address.region,
      town: address.town,
      latitude: address.latitude,
      longitude: address.longitude,
      isDefault: address.isDefault,
    },
  })
  useRevalidateOnChange(form)

  const onSubmit: SubmitHandler<z.infer<typeof updateAddressFormSchema>> = (values) => {
    startTransition(async () => {
      const response = await updateAddressAction({ userId: address.userId, data: values })

      if (!response.success) {
        toast.add({
          title: "Operation failed",
          description: response.error,
          type: "error",
        })
        return
      }

      setDialogIsOpen(false)
      router.refresh()
      toast.add({
        title: "Operation successful",
        description: "Address updated successfully.",
        type: "success",
      })
    })
  }

  const selectedRegion = useWatch({ control: form.control, name: "region" })
  const townOptions = useMemo(() => (GEODATA.find((region) => region.name === selectedRegion)?.towns ?? []).map((town) => ({ label: town, value: town })), [selectedRegion])

  return (
    // The dialog is portaled, but React events still bubble to any form it's rendered inside
    <form
      onSubmit={(e) => {
        e.stopPropagation()
        form.handleSubmit(onSubmit)(e)
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <TextInputField control={form.control} label="Full name" name="name" disabled={isPending} />
        </div>

        <div className="col-span-2">
          <PhoneField control={form.control} label="Phone" name="phone" disabled={isPending} defaultCountry="GH" />
        </div>

        <div className="col-span-2">
          <TextInputField control={form.control} label="Full address" name="line1" disabled={isPending} />
        </div>

        <div className="col-span-2">
          <TextInputField control={form.control} label="Other address details" name="line2" disabled={isPending} />
        </div>
        <div>
          <ComboboxField
            control={form.control}
            label="Region"
            name="region"
            disabled={isPending}
            options={regionOptions}
            placeholder="Select a region"
            onValueChange={(region) => {
              if (region !== selectedRegion) form.setValue("town", "")
            }}
            modal
          />
        </div>
        <div>
          <ComboboxField control={form.control} label="Town" name="town" disabled={isPending || !selectedRegion} options={townOptions} placeholder="Select a town" modal />
        </div>
        {/* A default address stays default until another one replaces it */}
        {!address.isDefault && (
          <div>
            <SwitchField control={form.control} label="Set as default" name="isDefault" disabled={isPending} />
          </div>
        )}

        <div className="col-span-2">
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? <Spinner /> : "Update address"}
          </Button>
        </div>
      </div>
    </form>
  )
}
export default EditAddressDialog
