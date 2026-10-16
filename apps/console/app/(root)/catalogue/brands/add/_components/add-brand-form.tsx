"use client"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { addBrandFormSchema } from "@/lib/schemas/brand.schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "@workspace/ui/components/toast"
import SharedFormHeader from "@/components/shared-form-header"
import SharedFormFooter from "@/components/shared-form-footer"
import { createBrandAction } from "@/lib/actions/brand.actions"
import { ImageField, SelectField, SwitchField, TextareaField, TextInputField } from "@workspace/forms"
import { STATUS_OPTIONS } from "@/constants"
import { Status } from "@workspace/db/enums"
import { deleteImages, uploadImages } from "@/lib/storage"

const AddBrandForm = () => {
  const router = useRouter()

  // isSubmitting turns false as soon as onSubmit returns, while the redirect is still loading, so a second click
  // would create a second brand. This keeps the form locked from a successful create until the page changes.
  const [isCreated, setIsCreated] = useState(false)

  const form = useForm<z.input<typeof addBrandFormSchema>, unknown, z.output<typeof addBrandFormSchema>>({
    resolver: zodResolver(addBrandFormSchema),
    defaultValues: {
      name: "",
      logo: "",
      description: "",
      isFeatured: false,
      status: Status.DRAFT,
      website: "",
    },
  })

  const onSubmit: SubmitHandler<z.output<typeof addBrandFormSchema>> = async (brandData) => {
    const response = await createBrandAction(brandData)

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
      setIsCreated(true)
      router.push("/catalogue/brands")
      toast.add({
        title: "Brand created",
        description: "You can now assign it to products.",
        type: "success",
      })
    }
  }

  const isBusy = form.formState.isSubmitting || isCreated

  const handleAddLogo = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return await uploadImages(formData)
  }

  const handleRemoveLogo = async (url: string) => {
    await deleteImages([url])
  }

  const handleDiscard = async () => {
    const image = form.getValues("logo")
    try {
      if (image?.trim()) await deleteImages([image])
      router.push("/catalogue/brands")
    } catch (error) {
      toast.add({
        title: "Unable to discard brand",
        description: error instanceof Error ? error.message : "The uploaded logo could not be removed. Please try again.",
        type: "error",
      })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader
          heading="Create Brand"
          description="Create a new product brand."
          backTo="/catalogue/brands"
          isPending={isBusy}
          isDirty={form.formState.isDirty}
          handleDiscard={handleDiscard}
        />

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
                    />

                    <TextInputField control={form.control} label="Name" name="name" disabled={isBusy} autoFocus />

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
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>Set the status for this brand.</CardDescription>
              </CardHeader>
              <CardContent>
                <SelectField control={form.control} name="status" disabled={isBusy} options={STATUS_OPTIONS} aria-label="Status" />
              </CardContent>
            </Card>
          </div>

          <SharedFormFooter backTo="/catalogue/brands" isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>
    </form>
  )
}

export default AddBrandForm
