"use client"
import ComboboxField from "@workspace/forms/components/combobox-field"
import TextInputField from "@workspace/forms/components/text-input-field"
import SwitchField from "@workspace/forms/components/switch-field"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import { GEODATA } from "@workspace/contracts"
import { addAddressAction } from "@/lib/actions/user.actions"
import { addAddressFormSchema } from "@/lib/schemas/user.schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { SubmitHandler, useForm, useWatch } from "react-hook-form"
import { toast } from "@workspace/ui/components/toast"
import { z } from "zod"
import PhoneField from "@workspace/forms/components/phone-field"
import { useRevalidateOnChange } from "@workspace/forms/use-revalidate-on-change"

const regionOptions = GEODATA.map((data) => ({ label: data.name, value: data.name }))

const AddAddressDialog = ({ userId }: { userId: string }) => {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const form = useForm<z.infer<typeof addAddressFormSchema>>({
    resolver: zodResolver(addAddressFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      line1: "",
      line2: "",
      region: "",
      town: "",
      latitude: null,
      longitude: null,
      isDefault: false,
    },
  })
  useRevalidateOnChange(form)

  const onSubmit: SubmitHandler<z.infer<typeof addAddressFormSchema>> = (values) => {
    startTransition(async () => {
      const response = await addAddressAction({ userId, data: values })

      if (!response.success) {
        toast.add({
          title: "Operation failed",
          description: response.error,
          type: "error",
        })
        return
      }

      form.reset()
      setOpen(false)
      router.refresh()
      toast.add({
        title: "Operation successful",
        description: "Address added successfully.",
        type: "success",
      })
    })
  }

  const selectedRegion = useWatch({ control: form.control, name: "region" })
  const townOptions = useMemo(() => (GEODATA.find((region) => region.name === selectedRegion)?.towns ?? []).map((town) => ({ label: town, value: town })), [selectedRegion])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" type="button">
            <PlusCircle className="h-3.5 w-3.5" />
            Add address
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an address</DialogTitle>
          <DialogDescription>Add a delivery address for this user.</DialogDescription>
        </DialogHeader>
        {/* The dialog is portaled, but React events still bubble to any form it's rendered inside */}
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

            <div>
              <SwitchField control={form.control} label="Set as default" name="isDefault" disabled={isPending} />
            </div>

            <div className="col-span-2">
              <Button className="w-full" type="submit" disabled={isPending}>
                {isPending ? <Spinner /> : "Add address"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default AddAddressDialog
