"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { SubmitHandler, useForm } from "react-hook-form"
import z from "zod"
import { StoreStatus } from "@/types"
import ResourceFormHeader from "@/components/shared-form-header"
import { deleteImages, uploadImages } from "@/lib/storage"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { ImageField, SelectField, TextInputField } from "@workspace/forms"
import ResourceFormFooter from "@/components/shared-form-footer"
import RichTextField from "@workspace/forms/components/rich-text-editor/rich-text-field"
import { STORE_STATUS_OPTIONS } from "@/constants"
import { addStoreFormSchema } from "@/lib/schemas/store.schemas"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { toast } from "@workspace/ui/components/toast"

export default function AddStoreForm() {
  const router = useRouter()

  const form = useForm<z.infer<typeof addStoreFormSchema>>({
    resolver: zodResolver(addStoreFormSchema),
    defaultValues: {
      name: "",
      logo: "",
      returnsPolicy: null,
      shippingPolicy: null,
      status: StoreStatus.ACTIVE,
    },
  })
  const onSubmit: SubmitHandler<z.infer<typeof addStoreFormSchema>> = async (data) => {
    form.clearErrors("root")

    const { error: createOrgErr } = await consoleAuthClient.organization.create({
      name: data.name,
      slug: crypto.randomUUID(),
      logo: !data.logo ? undefined : data.logo,
      returnsPolicy: data.returnsPolicy ?? undefined,
      shippingPolicy: data.shippingPolicy ?? undefined,
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
      router.push("/stores")
      toast.add({
        title: "Store created successfully",
        description: "The store has been created successfully.",
        type: "success",
      })
    }
  }
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
          description="Create a new store to manage members and products."
          backTo="/stores"
          isPending={form.formState.isSubmitting}
          isDirty={form.formState.isDirty}
          handleDiscard={handleDiscard}
        />

        <div className="grid gap-8">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {/* Left column */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Store Details</CardTitle>
                  <CardDescription>Configure the basic information and settings for your store.</CardDescription>
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
                      disabled={form.formState.isSubmitting}
                      className="max-w-35"
                    />

                    <TextInputField control={form.control} label="Name" name="name" disabled={form.formState.isSubmitting} autoFocus />

                    <RichTextField
                      control={form.control}
                      name="shippingPolicy"
                      label="Shipping Policy"
                      placeholder="Describe your shipping policy..."
                      disabled={form.formState.isSubmitting}
                    />
                    <RichTextField
                      control={form.control}
                      name="returnsPolicy"
                      label="Returns Policy"
                      disabled={form.formState.isSubmitting}
                      placeholder="Describe your returns policy..."
                    />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>Set the status for this store.</CardDescription>
              </CardHeader>
              <CardContent>
                <SelectField control={form.control} name="status" disabled={form.formState.isSubmitting} options={STORE_STATUS_OPTIONS} />
              </CardContent>
            </Card>
          </div>

          <ResourceFormFooter
            backTo="/stores"
            isPending={form.formState.isSubmitting}
            isDirty={form.formState.isDirty}
            handleDiscard={handleDiscard}
          />
        </div>
      </div>
    </form>
  )
}
