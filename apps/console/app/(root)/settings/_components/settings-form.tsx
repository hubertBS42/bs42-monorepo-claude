"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { SubmitHandler, useForm, useWatch } from "react-hook-form"
import z from "zod"
import type { AppSettingsData } from "@workspace/contracts"
import { ImageField, NumberInputField, SwitchField, TextareaField, TextInputField } from "@workspace/forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { toast } from "@workspace/ui/components/toast"
import ResourceFormFooter from "@/components/shared-form-footer"
import ResourceFormHeader from "@/components/shared-form-header"
import { saveAppSettings } from "@/lib/actions/app-settings.actions"
import { appSettingsSchema } from "@/lib/schemas/app-settings.schemas"
import { deleteImages, uploadImages } from "@/lib/storage"

type FormValues = z.infer<typeof appSettingsSchema>

// version: the settings' version when the page loaded (getAppSettingsVersion), so a save can't undo someone else's
export default function SettingsForm({ settings, version }: { settings: AppSettingsData; version: string }) {
  const router = useRouter()

  const defaultValues: FormValues = {
    storeName: settings.storeName,
    storeDescription: settings.storeDescription ?? "",
    consoleName: settings.consoleName ?? "",
    consoleDescription: settings.consoleDescription ?? "",
    logoUrl: settings.logoUrl ?? "",
    faviconUrl: settings.faviconUrl ?? "",
    taxEnabled: settings.taxEnabled,
    // Rounded, because a fraction times 100 can come out as 15.000000000000002
    taxRatePercent: Math.round(settings.taxRate * 10000) / 100,
    taxShipping: settings.taxShipping,
    version,
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(appSettingsSchema),
    defaultValues,
  })

  // Files the live site uses right now. They are never deleted from the browser:
  // the server removes them after a successful save that replaces them.
  const [saved, setSaved] = useState({ logoUrl: defaultValues.logoUrl, faviconUrl: defaultValues.faviconUrl })

  // Files uploaded during this visit that no saved settings reference yet
  const [unsaved, setUnsaved] = useState<string[]>([])

  const isPending = form.formState.isSubmitting
  const taxEnabled = useWatch({ control: form.control, name: "taxEnabled" })

  const handleAdd = async (files: FileList) => {
    const formData = new FormData()
    Array.from(files).forEach((file) => formData.append("files", file))
    const urls = await uploadImages(formData)
    setUnsaved((current) => [...current, ...urls])
    return urls
  }

  const handleRemove = async (url: string) => {
    // Removing the saved logo in the form must not delete it while the site still shows it
    if (Object.values(saved).includes(url)) return

    await deleteImages([url])
    setUnsaved((current) => current.filter((item) => item !== url))
  }

  const handleDiscard = async () => {
    try {
      if (unsaved.length > 0) await deleteImages(unsaved)
      setUnsaved([])
      router.push("/")
    } catch (error) {
      toast.add({
        title: "Unable to discard changes",
        description: error instanceof Error ? error.message : "The uploaded images could not be removed. Please try again.",
        type: "error",
      })
    }
  }

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    const result = await saveAppSettings(data)
    if (!result.success) {
      toast.add({ title: "Unable to save settings", description: result.error, type: "error" })
      return
    }

    setSaved({ logoUrl: data.logoUrl, faviconUrl: data.faviconUrl })
    setUnsaved([])
    // The new version, so the next save from this page isn't mistaken for a stale one
    form.reset({ ...data, version: result.version })
    toast.add({ title: "Settings saved", type: "success" })
    router.refresh()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <ResourceFormHeader
          heading="Platform Settings"
          description="Manage the names, descriptions, branding and tax of the storefront and the console."
          backTo="/"
          isPending={isPending}
          isDirty={form.formState.isDirty}
          handleDiscard={handleDiscard}
        />

        <div className="grid gap-8">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {/* Left column */}
            <div className="grid gap-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Storefront</CardTitle>
                  <CardDescription>The name and description customers see in the store and in search results.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <TextInputField control={form.control} name="storeName" label="Name" disabled={isPending} autoFocus />
                    <TextareaField control={form.control} name="storeDescription" label="Description" placeholder="A short description (160 characters maximum)" disabled={isPending} />
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Console</CardTitle>
                  <CardDescription>The name staff see in the console and in invitation emails.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <TextInputField control={form.control} name="consoleName" label="Name" placeholder="Leave empty to use the storefront name" disabled={isPending} />
                    <TextareaField control={form.control} name="consoleDescription" label="Description" placeholder="A short description (160 characters maximum)" disabled={isPending} />
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tax</CardTitle>
                  <CardDescription>Prices are shown without tax. When tax is on, it is added at checkout and each order keeps the rate it was charged.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <SwitchField control={form.control} name="taxEnabled" label="Charge tax" description="Add tax to every order" variant="card" disabled={isPending} />
                    <NumberInputField control={form.control} name="taxRatePercent" label="Tax rate (%)" min={0} max={100} step={0.01} disabled={isPending || !taxEnabled} />
                    <SwitchField
                      control={form.control}
                      name="taxShipping"
                      label="Tax delivery fees"
                      description="Charge tax on the delivery fee too"
                      variant="card"
                      disabled={isPending || !taxEnabled}
                    />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <Card>
              <CardHeader>
                <CardTitle>Branding</CardTitle>
                <CardDescription>Shared by the storefront, the console and emails.</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <ImageField
                    control={form.control}
                    name="logoUrl"
                    sizeLimit={100}
                    maxImages={1}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    clearErrors={form.clearErrors}
                    label="Logo"
                    disabled={isPending}
                    orientation="horizontal"
                  />
                  <ImageField
                    control={form.control}
                    name="faviconUrl"
                    label="Favicon"
                    description="Square PNG, at least 256×256px, up to 100 KB"
                    accept="image/png"
                    square
                    minDimension={256}
                    sizeLimit={100}
                    maxImages={1}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    clearErrors={form.clearErrors}
                    disabled={isPending}
                    orientation="horizontal"
                  />
                </FieldGroup>
              </CardContent>
            </Card>
          </div>

          <ResourceFormFooter backTo="/" isPending={isPending} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>
    </form>
  )
}
