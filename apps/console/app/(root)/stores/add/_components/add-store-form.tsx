"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { SubmitHandler, useForm } from "react-hook-form"
import z from "zod"
import { StoreStatus } from "@/types"
import ResourceFormHeader from "@/components/shared-form-header"
import { deleteImages, uploadImages } from "@/lib/storage"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { ImageField, SelectField, TextInputField } from "@workspace/forms"
import ResourceFormFooter from "@/components/shared-form-footer"
import { STORE_STATUS_OPTIONS } from "@/constants"
import { addStoreFormSchema } from "@/lib/schemas/store.schemas"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { toast } from "@workspace/ui/components/toast"

export default function AddStoreForm() {
  const router = useRouter()
  // isSubmitting turns false as soon as onSubmit returns, while the redirect is still loading, so a second click
  // would create a second store. This keeps the form locked from a successful create until the page changes.
  const [isCreated, setIsCreated] = useState(false)

  const form = useForm<z.infer<typeof addStoreFormSchema>>({
    resolver: zodResolver(addStoreFormSchema),
    defaultValues: {
      name: "",
      logo: "",
      status: StoreStatus.ACTIVE,
    },
  })
  const onSubmit: SubmitHandler<z.infer<typeof addStoreFormSchema>> = async (data) => {
    form.clearErrors("root")

    const { error: createOrgErr } = await consoleAuthClient.organization.create({
      name: data.name,
      slug: crypto.randomUUID(),
      logo: !data.logo ? undefined : data.logo,
      status: data.status,
      keepCurrentActiveOrganization: true,
    })

    if (createOrgErr) {
      toast.add({
        title: "Operation failed",
        description: createOrgErr.message,
        type: "error",
      })
    } else {
      setIsCreated(true)
      router.push("/stores")
      toast.add({
        title: "Store created",
        description: "You can now add members and products.",
        type: "success",
      })
    }
  }
  const isBusy = form.formState.isSubmitting || isCreated

  const handleAddLogo = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return uploadImages(formData)
  }

  const handleRemoveLogo = async (url: string) => {
    await deleteImages([url])
  }

  const handleDiscard = async () => {
    const image = form.getValues("logo")
    try {
      if (image?.trim()) await deleteImages([image])
      router.push("/stores")
    } catch (error) {
      toast.add({
        title: "Unable to discard store",
        description: error instanceof Error ? error.message : "The uploaded logo could not be removed. Please try again.",
        type: "error",
      })
    }
  }
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <ResourceFormHeader
          heading="Add Store"
          description="Create a store with its own team, listings and orders."
          backTo="/stores"
          isPending={isBusy}
          isDirty={form.formState.isDirty}
        />

        <div className="grid gap-8">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {/* One column, as wide as the two-column forms' main one: there is no sidebar, Status is in the details */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Store Details</CardTitle>
                  <CardDescription>Its name and logo, which only staff see.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <ImageField
                      control={form.control}
                      name="logo"
                      sizeLimit={100}
                      maxImages={1}
                      onAdd={handleAddLogo}
                      onRemove={handleRemoveLogo}
                      clearErrors={form.clearErrors}
                      label="Logo"
                      disabled={isBusy}
                      className="max-w-35"
                    />

                    <TextInputField control={form.control} label="Name" name="name" disabled={isBusy} autoFocus />
                    <SelectField control={form.control} label="Status" name="status" disabled={isBusy} options={STORE_STATUS_OPTIONS} description="A suspended store's listings aren't on sale." />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>
          </div>

          <ResourceFormFooter backTo="/stores" isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>
    </form>
  )
}
