"use client"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { updateBrandFormSchema } from "@/lib/schemas/brand.schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "@workspace/ui/components/toast"
import SharedFormHeader from "@/components/shared-form-header"
import SharedFormFooter from "@/components/shared-form-footer"
import { updateBrandAction } from "@/lib/actions/brand.actions"
import { ImageField, SelectField, SwitchField, TextareaField, TextInputField } from "@workspace/forms"
import { BRAND_STATUS_OPTIONS } from "@/constants"
import type { Brand } from "@workspace/db/client"
import { deleteImages, uploadImages } from "@/lib/storage"
import DeleteBrand from "./delete-brand"

export default function EditBrandForm({ brand }: { brand: Brand }) {
  const router = useRouter()

  // isSubmitting turns false as soon as onSubmit returns, while the redirect is still loading.
  // This keeps the form locked from a successful save until the page changes.
  const [isSaved, setIsSaved] = useState(false)

  const form = useForm<z.input<typeof updateBrandFormSchema>, unknown, z.output<typeof updateBrandFormSchema>>({
    resolver: zodResolver(updateBrandFormSchema),
    defaultValues: {
      id: brand.id,
      name: brand.name,
      logo: brand.logo ?? "",
      description: brand.description ?? "",
      isFeatured: brand.isFeatured,
      status: brand.status,
      website: brand.website ?? "",
    },
  })

  const onSubmit: SubmitHandler<z.output<typeof updateBrandFormSchema>> = async (brandData) => {
    // updateBrandAction removes the previous logo itself once the update has been saved
    const response = await updateBrandAction(brandData)

    if (!response.success) {
      if (response.code === "NAME_EXISTS") {
        form.setError("name", {
          type: "custom",
          message: "A brand with this name already exists.",
        })
      } else {
        toast.add({
          title: "Operation failed",
          description: response.error,
          type: "error",
        })
      }
    } else {
      setIsSaved(true)
      router.push("/catalogue/brands")
      toast.add({
        title: "Brand updated",
        description: "Your changes have been saved.",
        type: "success",
      })
    }
  }

  const isBusy = form.formState.isSubmitting || isSaved

  const handleAddLogo = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return await uploadImages(formData)
  }

  const handleRemoveLogo = async (url: string) => {
    // The saved logo is removed by the server on save, so discarding needs no restore
    if (url === brand.logo) return
    await deleteImages([url])
  }

  const handleDiscard = async () => {
    const logo = form.getValues("logo")
    try {
      if (logo?.trim() && logo !== brand.logo) await deleteImages([logo])
      router.push("/catalogue/brands")
    } catch (error) {
      toast.add({
        title: "Unable to discard changes",
        description: error instanceof Error ? error.message : "The uploaded logo could not be removed. Please try again.",
        type: "error",
      })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader heading="Edit Brand" description="Edit this product brand." backTo="/catalogue/brands" isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />

        <div className="grid gap-8">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {/* Left column */}
            <div className="grid gap-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Brand Details</CardTitle>
                  <CardDescription>Configure the basic information for this brand.</CardDescription>
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
                      defaultValues={brand.logo}
                    />

                    <TextInputField control={form.control} label="Name" name="name" disabled={isBusy} />

                    <TextInputField control={form.control} label="Website" name="website" disabled={isBusy} placeholder="https://example.com" />
                    <TextareaField control={form.control} label="Description" name="description" disabled={isBusy} />
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>Settings for this brand.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SwitchField control={form.control} label="Featured" name="isFeatured" disabled={isBusy} description="Show this brand in featured sections" variant="card" />
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                  <CardDescription>Set the status for this brand.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SelectField control={form.control} name="status" disabled={isBusy} options={BRAND_STATUS_OPTIONS} aria-label="Status" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Danger Zone</CardTitle>
                  <CardDescription>Permanently delete this brand.</CardDescription>
                </CardHeader>
                <CardContent>
                  <DeleteBrand brand={brand} />
                </CardContent>
              </Card>
            </div>
          </div>

          <SharedFormFooter backTo="/catalogue/brands" isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>
    </form>
  )
}
