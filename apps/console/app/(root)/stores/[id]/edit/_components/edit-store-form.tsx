"use client"
import ResourceFormHeader from "@/components/shared-form-header"
import { updateStoreFormSchema } from "@/lib/schemas/store.schemas"
import { deleteImages, uploadImages } from "@/lib/storage"
import type { Store } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { ImageField, SelectField, TextInputField } from "@workspace/forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { toast } from "@workspace/ui/components/toast"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { SubmitHandler, useForm } from "react-hook-form"
import z from "zod"
import { STORE_STATUS_OPTIONS } from "@/constants"
import ResourceFormFooter from "@/components/shared-form-footer"
import DeleteStore from "@/components/delete-store"
import RichTextField from "@workspace/forms/components/rich-text-editor/rich-text-field"

export default function EditStoreForm({ store }: { store: Store }) {
  const router = useRouter()

  // isSubmitting turns false as soon as onSubmit returns, while the redirect is still loading.
  // This keeps the form locked from a successful save until the page changes.
  const [isSaved, setIsSaved] = useState(false)

  const form = useForm<z.infer<typeof updateStoreFormSchema>>({
    resolver: zodResolver(updateStoreFormSchema),
    defaultValues: {
      id: store.id,
      name: store.name,
      logo: store.logo ?? "",
      returnsPolicy: store.returnsPolicy,
      shippingPolicy: store.shippingPolicy,
      status: store.status,
    },
  })

  const onSubmit: SubmitHandler<z.infer<typeof updateStoreFormSchema>> = async (data) => {
    form.clearErrors("root")
    const { error: updateStoreErr } = await consoleAuthClient.organization.update({
      data: {
        name: data.name,
        logo: data.logo?.trim() ? data.logo : null,
        // "" rather than undefined, which would leave the policy unchanged. The organization hook sanitises the HTML
        // and stores an empty policy as null.
        returnsPolicy: data.returnsPolicy ?? "",
        shippingPolicy: data.shippingPolicy ?? "",
        status: data.status,
      },
      organizationId: store.id,
    })

    if (updateStoreErr) {
      toast.add({
        title: "Operation failed",
        description: updateStoreErr.message,
        type: "error",
      })

      return
    }

    // A replaced logo isn't deleted from here: once the store points at the new one, nothing references the old
    // file, and the orphaned-file sweep removes it
    setIsSaved(true)
    router.push("/stores")
    toast.add({
      title: "Store updated",
      description: "Your changes have been saved.",
      type: "success",
    })
  }

  const isBusy = form.formState.isSubmitting || isSaved

  const handleAddLogo = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return uploadImages(formData)
  }

  const handleRemoveLogo = async (url: string) => {
    // The saved logo stays until a save replaces it, so discarding needs no restore
    if (url === store.logo) return
    await deleteImages([url])
  }

  const handleDiscard = async () => {
    const image = form.getValues("logo")
    try {
      if (image?.trim() && image !== store.logo) await deleteImages([image])
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
          heading="Edit Store"
          description="Update the store's details and status."
          backTo="/stores"
          isPending={isBusy}
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
                  <CardDescription>Configure the basic information and settings for this store.</CardDescription>
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
                      defaultValues={store.logo}
                    />
                    <TextInputField control={form.control} label="Name" name="name" disabled={isBusy} autoFocus />

                    <RichTextField control={form.control} label="Shipping Policy" name="shippingPolicy" placeholder="Write something..." disabled={isBusy} />

                    <RichTextField control={form.control} label="Returns Policy" name="returnsPolicy" placeholder="Write something..." disabled={isBusy} />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                  <CardDescription>Set the status for this store.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SelectField control={form.control} name="status" disabled={isBusy} options={STORE_STATUS_OPTIONS} aria-label="Status" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Danger Zone</CardTitle>
                  <CardDescription>Permanently delete this store.</CardDescription>
                </CardHeader>
                <CardContent>
                  <DeleteStore store={store} />
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
