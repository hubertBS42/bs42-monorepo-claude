"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, type SubmitHandler, type UseFormReturn } from "react-hook-form"
import type { z } from "zod"
import { PlusCircle, Save, X } from "lucide-react"
import { GEODATA } from "@workspace/contracts"
import { ComboboxField, NumberInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { InfoTip } from "@workspace/ui/components/info-tip"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { saveDeliverySettingsAction } from "@/lib/actions/delivery.actions"
import type { DeliverySettingsView } from "@/lib/data/delivery.data"
import { deliverySettingsFormSchema } from "@/lib/schemas/delivery.schemas"

// Its own form, saved apart from the settings row: fees are replaced together, and orders copy the fee they used

type FormInput = z.input<typeof deliverySettingsFormSchema>
type FormOutput = z.output<typeof deliverySettingsFormSchema>
type DeliveryForm = UseFormReturn<FormInput, unknown, FormOutput>

// Every region in GEODATA's order, with its fee and town fees from the saved rates
function toFormValues(settings: DeliverySettingsView): FormInput {
  return {
    freeDeliveryFromGhs: settings.freeDeliveryFromGhs === null ? "" : Number(settings.freeDeliveryFromGhs),
    regions: GEODATA.map(({ name }) => {
      const own = settings.rates.find((rate) => rate.region === name && rate.town === null)
      return {
        region: name,
        feeGhs: own ? Number(own.feeGhs) : "",
        towns: settings.rates.filter((rate) => rate.region === name && rate.town !== null).map((rate) => ({ town: rate.town!, feeGhs: Number(rate.feeGhs) })),
      }
    }),
  }
}

export default function DeliveryCard({ settings }: { settings: DeliverySettingsView }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(deliverySettingsFormSchema),
    defaultValues: toFormValues(settings),
  })

  const onSubmit: SubmitHandler<FormOutput> = (values) => {
    startTransition(async () => {
      const response = await saveDeliverySettingsAction({ version: settings.version, settings: values })

      if (!response.success) {
        toast.add({ title: "Unable to save the delivery fees", description: response.error, type: "error" })
        if (response.code === "CONFLICT") router.refresh()
        return
      }

      toast.add({ title: "Delivery fees saved", description: "New orders use them from now on.", type: "success" })
      form.reset(form.getValues())
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Delivery
          <InfoTip about="Delivery">
            Leave a region empty to deliver only to its towns that have a fee. One fee per order, whatever its weight. Staff can still change the fee on orders they create.
          </InfoTip>
        </CardTitle>
        <CardDescription>Fees in GHS. A town&apos;s fee overrides its region&apos;s; places without a fee aren&apos;t delivered to.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* stopPropagation keeps a submit from reaching any form around it */}
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            form.handleSubmit(onSubmit)(e)
          }}
          className="grid gap-6"
        >
          <NumberInputField
            control={form.control}
            label="Free delivery from"
            name="freeDeliveryFromGhs"
            step={0.01}
            min={0}
            prependText="GH₵"
            description="Subtotal after discount. Leave empty to always charge."
            info="Counts the goods after any discount, not installation or tax. Staff can also apply free delivery on orders they create."
            disabled={isPending}
          />

          <div className="grid gap-1">
            <div className="grid grid-cols-[minmax(0,1fr)_10rem] gap-4 px-1 text-sm font-medium text-muted-foreground">
              <span>Region</span>
              <span>Fee</span>
            </div>
            <Separator />
            {GEODATA.map((region, index) => (
              <RegionFees key={region.name} form={form} index={index} towns={region.towns} disabled={isPending} />
            ))}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending || !form.formState.isDirty}>
              {isPending ? (
                <Spinner />
              ) : (
                <>
                  <Save /> Save
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function RegionFees({ form, index, towns, disabled }: { form: DeliveryForm; index: number; towns: string[]; disabled: boolean }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: `regions.${index}.towns`, keyName: "key" })
  const region = GEODATA[index]!.name
  const townOptions = towns.map((town) => ({ label: town, value: town }))

  return (
    <div className="grid gap-2 border-b py-3 last:border-b-0">
      <div className="grid grid-cols-[minmax(0,1fr)_10rem] items-start gap-4 px-1">
        <div className="flex flex-wrap items-center gap-2 pt-1.5">
          <span className="text-sm font-medium">{region}</span>
          <Button type="button" variant="ghost" size="xs" disabled={disabled} onClick={() => append({ town: "", feeGhs: 0 })}>
            <PlusCircle />
            Town fee
          </Button>
        </div>
        <NumberInputField control={form.control} name={`regions.${index}.feeGhs`} aria-label={`${region} fee`} placeholder="No delivery" step={0.01} min={0} prependText="GH₵" disabled={disabled} />
      </div>

      {fields.map((field, townIndex) => (
        <div key={field.key} className="grid grid-cols-[minmax(0,1fr)_10rem] items-start gap-4 pl-6">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <ComboboxField
                control={form.control}
                name={`regions.${index}.towns.${townIndex}.town`}
                options={townOptions}
                placeholder="Select a town"
                emptyMessage="No towns found."
                disabled={disabled}
              />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove town fee" disabled={disabled} onClick={() => remove(townIndex)}>
              <X />
            </Button>
          </div>
          <NumberInputField control={form.control} name={`regions.${index}.towns.${townIndex}.feeGhs`} aria-label="Town fee" step={0.01} min={0} prependText="GH₵" disabled={disabled} />
        </div>
      ))}
    </div>
  )
}
