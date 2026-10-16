"use client"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Control, FieldValues, Path, UseFormClearErrors } from "react-hook-form"
import TextInputField from "@workspace/forms/components/text-input-field"
import NumberInputField from "@workspace/forms/components/number-input-field"
import ImageField from "@workspace/forms/components/image-field"
import { FieldGroup } from "@workspace/ui/components/field"
import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"
import { deleteImages, uploadImages } from "@/lib/storage"

interface VariantSheetProps<T extends FieldValues> {
  open: boolean
  onOpenChange: (open: boolean) => void
  index: number
  control: Control<T>
  attributes: Record<string, string>
  images: string[]
  clearErrors: UseFormClearErrors<T>
}

const VariantSheet = <T extends FieldValues>({ open, onOpenChange, index, control, attributes, images, clearErrors }: VariantSheetProps<T>) => {
  const handleAddImages = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return uploadImages(formData)
  }

  const handleRemoveImage = async (url: string) => {
    // Saved images are removed by the server on save; only this edit's uploads are deleted here
    if (images.includes(url)) return
    await deleteImages([url])
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="min-w-full sm:min-w-125">
        <SheetHeader>
          <SheetTitle className="text-lg">Edit Variant</SheetTitle>
          <SheetDescription>Details, shipping and images for this variant.</SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 overflow-y-auto px-4 pb-5">
          {/* Attributes */}
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(attributes).map(([key, value]) => (
              <Badge key={key} variant="secondary">
                {key}: {value}
              </Badge>
            ))}
          </div>
          {/* Details */}
          <div className="grid gap-y-4">
            <h3 className="text-sm font-medium">Details</h3>
            <FieldGroup>
              <TextInputField control={control} name={`variants.${index}.sku` as Path<T>} label="SKU" placeholder="Leave empty to auto-generate" />
              <TextInputField control={control} name={`variants.${index}.barcode` as Path<T>} label="Barcode" placeholder="e.g. 123456789" />
            </FieldGroup>
          </div>

          <Separator />

          {/* Shipping */}
          <div className="grid gap-y-4">
            <h3 className="text-sm font-medium">Shipping</h3>
            <FieldGroup>
              <NumberInputField control={control} name={`variants.${index}.weight` as Path<T>} label="Weight (kg)" step={0.01} />
              <TextInputField control={control} name={`variants.${index}.dimensions` as Path<T>} label="Dimensions" placeholder="e.g. 10x5x3 cm" />
            </FieldGroup>
          </div>

          <Separator />

          {/* Images */}
          <div className="grid gap-y-4">
            <h3 className="text-sm font-medium">Images</h3>
            <ImageField
              control={control}
              name={`variants.${index}.images` as Path<T>}
              maxImages={4}
              sizeLimit={100}
              onAdd={handleAddImages}
              onRemove={handleRemoveImage}
              clearErrors={clearErrors}
              className="w-full"
              defaultValues={images}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default VariantSheet
