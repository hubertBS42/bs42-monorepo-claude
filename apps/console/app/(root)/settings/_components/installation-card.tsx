"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch, type SubmitHandler, type UseFormReturn } from "react-hook-form"
import type { z } from "zod"
import { PlusCircle, X } from "lucide-react"
import { GEODATA } from "@workspace/contracts"
import { ComboboxField, SwitchField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { saveInstallationAreasAction } from "@/lib/actions/installation.actions"
import type { InstallationAreasView } from "@/lib/data/installation.data"
import { installationAreasFormSchema } from "@/lib/schemas/installation.schemas"

// Its own form, saved apart from the settings row like the Delivery card: the areas are replaced together

type FormInput = z.input<typeof installationAreasFormSchema>
type FormOutput = z.output<typeof installationAreasFormSchema>
type InstallationForm = UseFormReturn<FormInput, unknown, FormOutput>

// Every region in GEODATA's order, whole or with its towns, from the saved areas
function toFormValues(settings: InstallationAreasView): FormInput {
  return {
    regions: GEODATA.map(({ name }) => ({
      region: name,
      whole: settings.areas.some((area) => area.region === name && area.town === null),
      towns: settings.areas.filter((area) => area.region === name && area.town !== null).map((area) => ({ town: area.town! })),
    })),
  }
}

export default function InstallationCard({ settings }: { settings: InstallationAreasView }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(installationAreasFormSchema),
    defaultValues: toFormValues(settings),
  })

  const onSubmit: SubmitHandler<FormOutput> = (values) => {
    startTransition(async () => {
      const response = await saveInstallationAreasAction({ version: settings.version, settings: values })

      if (!response.success) {
        toast.add({ title: "Unable to save where installation is offered", description: response.error, type: "error" })
        if (response.code === "CONFLICT") router.refresh()
        return
      }

      toast.add({ title: "Installation areas saved", description: "Customers in them can add installation from now on.", type: "success" })
      form.reset(form.getValues())
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Installation</CardTitle>
        <CardDescription>
          Where the platform&apos;s installers work: a whole region, or some of its towns. Customers can add installation to products with a fee (set on the category or the product) and check out only
          to an address here.
        </CardDescription>
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
          <div className="grid gap-1">
            <div className="px-1 text-sm font-medium text-muted-foreground">Region</div>
            <Separator />
            {GEODATA.map((region, index) => (
              <RegionAreas key={region.name} form={form} index={index} towns={region.towns} disabled={isPending} />
            ))}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending || !form.formState.isDirty}>
              {isPending ? <Spinner /> : "Save installation areas"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function RegionAreas({ form, index, towns, disabled }: { form: InstallationForm; index: number; towns: string[]; disabled: boolean }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: `regions.${index}.towns`, keyName: "key" })
  const whole = useWatch({ control: form.control, name: `regions.${index}.whole` })
  const region = GEODATA[index]!.name
  const townOptions = towns.map((town) => ({ label: town, value: town }))

  return (
    <div className="grid gap-2 border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{region}</span>
          {!whole && (
            <Button type="button" variant="ghost" size="xs" disabled={disabled} onClick={() => append({ town: "" })}>
              <PlusCircle />
              Town
            </Button>
          )}
        </div>
        <SwitchField control={form.control} name={`regions.${index}.whole`} label="Whole region" size="sm" disabled={disabled} className="w-auto" />
      </div>

      {!whole &&
        fields.map((field, townIndex) => (
          <div key={field.key} className="flex items-start gap-2 pl-6">
            <div className="max-w-80 flex-1">
              <ComboboxField
                control={form.control}
                name={`regions.${index}.towns.${townIndex}.town`}
                options={townOptions}
                placeholder="Select a town"
                emptyMessage="No towns found."
                disabled={disabled}
              />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove town" disabled={disabled} onClick={() => remove(townIndex)}>
              <X />
            </Button>
          </div>
        ))}
    </div>
  )
}
