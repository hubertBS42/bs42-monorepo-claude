"use client"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { NO_PARENT, updateCategoryFormSchema } from "@/lib/schemas/category.schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "@workspace/ui/components/toast"
import SharedFormHeader from "@/components/shared-form-header"
import SharedFormFooter from "@/components/shared-form-footer"
import { updateCategoryAction } from "@/lib/actions/category.actions"
import { ImageField, NumberInputField, SelectField, SelectTreeField, SwitchField, TextareaField, TextInputField, type TreeSelectOption } from "@workspace/forms"
import { STATUS_OPTIONS } from "@/constants"
import type { CategoryForEdit } from "@/lib/data/categories.data"
import { deleteImages, uploadImages } from "@/lib/storage"
import DeleteCategory from "./delete-category"

interface EditCategoryFormProps {
  // From getCategoryById
  category: CategoryForEdit
  // The category tree from getCategoryOptions(category.id)
  parentOptions: TreeSelectOption[]
  // Archived categories, plus this category and its subcategories (picking one would make a cycle)
  disabledParentIds: string[]
}

export default function EditCategoryForm({ category, parentOptions, disabledParentIds }: EditCategoryFormProps) {
  const router = useRouter()

  // isSubmitting turns false as soon as onSubmit returns, while the redirect is still loading.
  // This keeps the form locked from a successful save until the page changes.
  const [isSaved, setIsSaved] = useState(false)

  const form = useForm<z.input<typeof updateCategoryFormSchema>, unknown, z.output<typeof updateCategoryFormSchema>>({
    resolver: zodResolver(updateCategoryFormSchema),
    defaultValues: {
      id: category.id,
      name: category.name,
      image: category.image ?? "",
      parentId: category.parentId ?? NO_PARENT,
      description: category.description ?? "",
      isFeatured: category.isFeatured,
      installationFeeGhs: category.installationFeeGhs ?? "",
      status: category.status,
    },
  })

  const options = [{ label: "No parent (top-level category)", value: NO_PARENT }, ...parentOptions]

  const onSubmit: SubmitHandler<z.output<typeof updateCategoryFormSchema>> = async (categoryData) => {
    // updateCategoryAction removes the previous image itself once the update has been saved
    const response = await updateCategoryAction(categoryData)

    if (!response.success) {
      if (response.code === "NAME_EXISTS") {
        form.setError("name", { type: "custom", message: response.error })
      } else if (response.code === "PARENT_NOT_FOUND" || response.code === "PARENT_ARCHIVED" || response.code === "PARENT_CYCLE") {
        form.setError("parentId", { type: "custom", message: response.error })
      } else {
        toast.add({
          title: "Operation failed",
          description: response.error,
          type: "error",
        })
      }
    } else {
      setIsSaved(true)
      router.push("/catalogue/categories")
      toast.add({
        title: "Category updated",
        description: "Your changes have been saved.",
        type: "success",
      })
    }
  }

  const isBusy = form.formState.isSubmitting || isSaved

  const handleAddImage = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return await uploadImages(formData)
  }

  const handleRemoveImage = async (url: string) => {
    // The saved image is removed by the server on save, so discarding needs no restore
    if (url === category.image) return
    await deleteImages([url])
  }

  const handleDiscard = async () => {
    const image = form.getValues("image")
    try {
      if (image?.trim() && image !== category.image) await deleteImages([image])
      router.push("/catalogue/categories")
    } catch (error) {
      toast.add({
        title: "Unable to discard changes",
        description: error instanceof Error ? error.message : "The uploaded image could not be removed. Please try again.",
        type: "error",
      })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader
          heading="Edit Category"
          description="Edit this product category."
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
                      defaultValues={category.image}
                    />

                    <TextInputField control={form.control} label="Name" name="name" disabled={isBusy} />

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
                      info="Products set to use their category's fee take the nearest category up the tree that has one. If none does, they aren't installed."
                    />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                  <CardDescription>Set the status for this category.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SelectField control={form.control} name="status" disabled={isBusy} options={STATUS_OPTIONS} aria-label="Status" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Danger Zone</CardTitle>
                  <CardDescription>Permanently delete this category.</CardDescription>
                </CardHeader>
                <CardContent>
                  <DeleteCategory category={category} childCount={category.childCount} />
                </CardContent>
              </Card>
            </div>
          </div>

          <SharedFormFooter backTo="/catalogue/categories" isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>
    </form>
  )
}
