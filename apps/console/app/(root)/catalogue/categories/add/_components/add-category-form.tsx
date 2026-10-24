"use client"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { addCategoryFormSchema, NO_PARENT } from "@/lib/schemas/category.schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "@workspace/ui/components/toast"
import SharedFormHeader from "@/components/shared-form-header"
import SharedFormFooter from "@/components/shared-form-footer"
import { createCategoryAction } from "@/lib/actions/category.actions"
import { ImageField, NumberInputField, SelectField, SelectTreeField, SwitchField, TextareaField, TextInputField, type TreeSelectOption } from "@workspace/forms"
import { STATUS_OPTIONS } from "@/constants"
import { Status } from "@workspace/db/enums"
import { deleteImages, uploadImages } from "@/lib/storage"

interface AddCategoryFormProps {
  // The category tree from getCategoryOptions
  parentOptions: TreeSelectOption[]
  // Archived categories: shown in the tree but can't be picked
  disabledParentIds: string[]
}

const AddCategoryForm = ({ parentOptions, disabledParentIds }: AddCategoryFormProps) => {
  const router = useRouter()

  // isSubmitting turns false as soon as onSubmit returns, while the redirect is still loading, so a second click
  // would create a second category. This keeps the form locked from a successful create until the page changes.
  const [isCreated, setIsCreated] = useState(false)

  const form = useForm<z.input<typeof addCategoryFormSchema>, unknown, z.output<typeof addCategoryFormSchema>>({
    resolver: zodResolver(addCategoryFormSchema),
    defaultValues: {
      name: "",
      image: "",
      parentId: NO_PARENT,
      description: "",
      isFeatured: false,
      installationFeeGhs: "",
      status: Status.DRAFT,
    },
  })

  const options = [{ label: "No parent (top-level category)", value: NO_PARENT }, ...parentOptions]

  const onSubmit: SubmitHandler<z.output<typeof addCategoryFormSchema>> = async (categoryData) => {
    const response = await createCategoryAction(categoryData)

    if (!response.success) {
      if (response.code === "NAME_EXISTS") {
        form.setError("name", { type: "custom", message: response.error })
      } else if (response.code === "PARENT_NOT_FOUND" || response.code === "PARENT_ARCHIVED") {
        form.setError("parentId", { type: "custom", message: response.error })
      } else {
        toast.add({
          title: "Operation failed",
          description: response.error,
          type: "error",
        })
      }
    } else {
      setIsCreated(true)
      router.push("/catalogue/categories")
      toast.add({
        title: "Category created",
        description: "You can now assign products to it.",
        type: "success",
      })
    }
  }

  const isBusy = form.formState.isSubmitting || isCreated

  const handleAddImage = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return await uploadImages(formData)
  }

  const handleRemoveImage = async (url: string) => {
    await deleteImages([url])
  }

  const handleDiscard = async () => {
    const image = form.getValues("image")
    try {
      if (image?.trim()) await deleteImages([image])
      router.push("/catalogue/categories")
    } catch (error) {
      toast.add({
        title: "Unable to discard category",
        description: error instanceof Error ? error.message : "The uploaded image could not be removed. Please try again.",
        type: "error",
      })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader
          heading="Create Category"
          description="Create a new product category."
          backTo="/catalogue/categories"
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
                  <CardTitle>Category Details</CardTitle>
                  <CardDescription>Configure the basic information for this category.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <ImageField
                      control={form.control}
                      name="image"
                      sizeLimit={500}
                      maxImages={1}
                      onAdd={handleAddImage}
                      onRemove={handleRemoveImage}
                      clearErrors={form.clearErrors}
                      label="Image"
                      description="About 1600 × 600, for the homepage carousel."
                      disabled={isBusy}
                      className="max-w-35"
                    />

                    <TextInputField control={form.control} label="Name" name="name" disabled={isBusy} autoFocus />

                    <SelectTreeField control={form.control} name="parentId" label="Parent category" options={options} disabledOptions={disabledParentIds} disabled={isBusy} />

                    <TextareaField control={form.control} label="Description" name="description" disabled={isBusy} />
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>Settings for this category.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <SwitchField control={form.control} label="Featured" name="isFeatured" disabled={isBusy} description="Show in the homepage carousel (up to 6)" variant="card" />
                    <NumberInputField
                      control={form.control}
                      label="Installation fee"
                      name="installationFeeGhs"
                      step={0.01}
                      min={0}
                      prependText="GH₵"
                      disabled={isBusy}
                      description="Per item, for products here and below without their own. Empty uses the parent's."
                    />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>Set the status for this category.</CardDescription>
              </CardHeader>
              <CardContent>
                <SelectField control={form.control} name="status" disabled={isBusy} options={STATUS_OPTIONS} aria-label="Status" />
              </CardContent>
            </Card>
          </div>

          <SharedFormFooter backTo="/catalogue/categories" isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>
    </form>
  )
}

export default AddCategoryForm
