"use client"

import { useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type DefaultValues, type UseFormReturn } from "react-hook-form"
import type { z } from "zod"
import { Save } from "lucide-react"
import type { AppSettingsData } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { saveSettingsSection } from "@/lib/actions/app-settings.actions"
import { settingsSectionSchemas, type SectionInput, type SectionOutput, type SettingsSection } from "@/lib/schemas/app-settings.schemas"
import { sectionValues } from "@/lib/settings-sections"

interface SettingsCardProps<S extends SettingsSection> {
  section: S
  settings: AppSettingsData
  title: string
  description: ReactNode
  // Run after a save, e.g. the branding card forgetting its uploads
  onSaved?: () => void
  children: (form: UseFormReturn<SectionInput<S>, unknown, SectionOutput<S>>, isPending: boolean) => ReactNode
}

// One card of settings with its own Save, writing only its own fields (saveSettingsSection). Keyed by the saved
// values, so a refresh after a save, or after someone else's, starts the form afresh from them.
export default function SettingsCard<S extends SettingsSection>(props: SettingsCardProps<S>) {
  return <SettingsCardForm key={JSON.stringify(sectionValues(props.settings, props.section))} {...props} />
}

function SettingsCardForm<S extends SettingsSection>({ section, settings, title, description, onSaved, children }: SettingsCardProps<S>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const original = sectionValues(settings, section)
  const form = useForm<SectionInput<S>, unknown, SectionOutput<S>>({
    resolver: zodResolver(settingsSectionSchemas[section] as unknown as z.ZodType<SectionOutput<S>, SectionInput<S>>),
    defaultValues: original as DefaultValues<SectionInput<S>>,
  })

  const onSubmit = (values: SectionOutput<S>) => {
    startTransition(async () => {
      const response = await saveSettingsSection(section, values as SectionInput<S>, original)
      if (!response.success) {
        toast.add({ title: `Unable to save ${title.toLowerCase()} settings`, description: response.error, type: "error" })
        // Show the settings as they are now
        if (response.code === "CONFLICT") router.refresh()
        return
      }
      onSaved?.()
      toast.add({ title: `${title} settings saved`, type: "success" })
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
          <FieldGroup>{children(form, isPending)}</FieldGroup>
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
