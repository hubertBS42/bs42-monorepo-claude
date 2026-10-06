"use client"

import * as React from "react"
import { ImageIcon, X } from "lucide-react"
import {
  Controller,
  type Control,
  type FieldPathValue,
  type FieldValues,
  type Path,
  type UseFormClearErrors,
} from "react-hook-form"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@workspace/ui/components/attachment"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { Input } from "@workspace/ui/components/input"

import { truncateTitle } from "../utils/truncate-title"

interface ImageFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  label?: string
  description?: string
  className?: string
  disabled?: boolean
  maxImages?: number
  sizeLimit?: number
  accept?: string
  defaultValues?: string | string[] | null
  clearErrors?: UseFormClearErrors<T>
  onAdd: (images: FileList) => Promise<string[]>
  onRemove: (url: string) => Promise<void>
}

function toImageUrls(value: unknown): string[] {
  if (typeof value === "string") return value ? [value] : []
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }
  return []
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function getImageTitle(url: string, index: number): string {
  if (url.startsWith("data:")) return `Image ${index + 1}`

  try {
    const parsedUrl = new URL(url)
    const fileName = decodeURIComponent(
      parsedUrl.pathname.split("/").filter(Boolean).at(-1) ?? ""
    )
    if (fileName) return fileName
  } catch {
    const fileName = url.split(/[?#]/, 1)[0]?.split("/").filter(Boolean).at(-1)
    if (fileName) return fileName
  }

  return `Image ${index + 1}`
}

const ImageField = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled = false,
  maxImages = 1,
  sizeLimit = 1000,
  accept = "image/*",
  defaultValues,
  clearErrors,
  onAdd,
  onRemove,
}: ImageFieldProps<T>) => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const generatedId = React.useId()
  const inputId = `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`
  const labelId = `${inputId}-label`
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`
  const [isUploading, setIsUploading] = React.useState(false)
  const [removingIndex, setRemovingIndex] = React.useState<number | null>(null)
  const [operationError, setOperationError] = React.useState<string | null>(
    null
  )
  const [uploadedImageTitles, setUploadedImageTitles] = React.useState<
    Record<string, string>
  >({})
  const imageLimit = Math.max(1, Math.floor(maxImages))
  const initialUrls = toImageUrls(defaultValues)
  const initialValue = imageLimit === 1 ? (initialUrls[0] ?? "") : initialUrls

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <Controller
      control={control}
      name={name}
      defaultValue={initialValue as FieldPathValue<T, Path<T>>}
      render={({ field, fieldState }) => {
        const imageUrls = toImageUrls(field.value)
        const isBusy = isUploading || removingIndex !== null
        const canAddImage =
          !disabled && !isBusy && imageUrls.length < imageLimit
        const describedBy =
          [
            description ? descriptionId : undefined,
            fieldState.invalid || operationError ? errorId : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined

        const updateValue = (urls: string[]) => {
          field.onChange(imageLimit === 1 ? (urls[0] ?? "") : urls)
        }

        const handleFileChange = async (
          event: React.ChangeEvent<HTMLInputElement>
        ) => {
          const files = event.currentTarget.files
          if (!files?.length) return

          const selectedFiles = Array.from(files)
          const availableSlots = imageLimit - imageUrls.length

          try {
            if (selectedFiles.some((file) => !file.type.startsWith("image/"))) {
              throw new Error("Choose image files only.")
            }

            if (selectedFiles.some((file) => file.size > sizeLimit * 1024)) {
              throw new Error(`Each image must be ${sizeLimit} KB or smaller.`)
            }

            if (selectedFiles.length > availableSlots) {
              throw new Error(
                `You can add up to ${imageLimit} image${imageLimit === 1 ? "" : "s"}.`
              )
            }

            setOperationError(null)
            clearErrors?.(name)
            setIsUploading(true)
            const uploadedUrls = await onAdd(files)

            if (
              !Array.isArray(uploadedUrls) ||
              uploadedUrls.length !== selectedFiles.length ||
              uploadedUrls.some((url) => typeof url !== "string" || !url)
            ) {
              throw new Error(
                "The upload did not return a URL for every selected image."
              )
            }

            updateValue([...imageUrls, ...uploadedUrls])
            setUploadedImageTitles((currentTitles) => ({
              ...currentTitles,
              ...Object.fromEntries(
                uploadedUrls.map((url, index) => [
                  url,
                  selectedFiles[index]?.name ?? getImageTitle(url, index),
                ])
              ),
            }))
          } catch (error) {
            setOperationError(
              getErrorMessage(error, "Unable to upload the selected images.")
            )
          } finally {
            setIsUploading(false)
            clearInput()
          }
        }

        const handleRemove = async (index: number) => {
          const url = imageUrls[index]
          if (!url) return

          setOperationError(null)
          clearErrors?.(name)
          setRemovingIndex(index)

          try {
            await onRemove(url)
            updateValue(imageUrls.filter((_, itemIndex) => itemIndex !== index))
            if (
              !imageUrls.some(
                (image, itemIndex) => image === url && itemIndex !== index
              )
            ) {
              setUploadedImageTitles((currentTitles) => {
                const nextTitles = { ...currentTitles }
                delete nextTitles[url]
                return nextTitles
              })
            }
          } catch (error) {
            setOperationError(
              getErrorMessage(error, "Unable to remove this image.")
            )
          } finally {
            setRemovingIndex(null)
          }
        }

        return (
          <Field
            className="grid gap-1"
            data-disabled={disabled}
            data-invalid={fieldState.invalid || Boolean(operationError)}
          >
            {label && (
              <FieldLabel id={labelId} htmlFor={inputId}>
                {label}
              </FieldLabel>
            )}

            <Input
              ref={(element) => {
                inputRef.current = element
                field.ref(element)
              }}
              id={inputId}
              name={field.name}
              type="file"
              accept={accept}
              multiple={imageLimit > 1}
              disabled={disabled || isBusy || imageUrls.length >= imageLimit}
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onBlur={field.onBlur}
              onChange={handleFileChange}
            />

            <AttachmentGroup
              aria-labelledby={label ? labelId : undefined}
              aria-describedby={describedBy}
              className={className}
            >
              {imageUrls.map((url, index) => {
                const imageTitle =
                  uploadedImageTitles[url] ?? getImageTitle(url, index)

                return (
                  <Attachment
                    key={`${url}-${index}`}
                    orientation="vertical"
                    state={removingIndex === index ? "processing" : "done"}
                    className="w-32"
                  >
                    <AttachmentMedia variant="image">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={imageTitle} />
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle title={imageTitle}>
                        {truncateTitle(imageTitle)}
                      </AttachmentTitle>
                      <AttachmentDescription>
                        {removingIndex === index ? "Removing..." : "Uploaded"}
                      </AttachmentDescription>
                    </AttachmentContent>
                    <AttachmentActions>
                      <AttachmentAction
                        type="button"
                        aria-label={`Remove ${imageTitle}`}
                        title={`Remove ${imageTitle}`}
                        disabled={isBusy || disabled}
                        onClick={() => void handleRemove(index)}
                      >
                        {removingIndex === index ? <Spinner /> : <X />}
                      </AttachmentAction>
                    </AttachmentActions>
                  </Attachment>
                )
              })}

              {isUploading && (
                <Attachment
                  orientation="vertical"
                  state="uploading"
                  className="w-32"
                  aria-live="polite"
                >
                  <AttachmentMedia>
                    <Spinner />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>Uploading images</AttachmentTitle>
                    <AttachmentDescription>
                      Please wait...
                    </AttachmentDescription>
                  </AttachmentContent>
                </Attachment>
              )}

              {canAddImage && (
                <Attachment
                  orientation="vertical"
                  state="idle"
                  className="w-32"
                >
                  <AttachmentMedia>
                    <ImageIcon className="text-muted-foreground" />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>Add image</AttachmentTitle>
                    <AttachmentDescription>
                      {`Up to ${sizeLimit} KB`}
                    </AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentTrigger
                    aria-label={`Add ${label ?? "image"}`}
                    aria-describedby={describedBy}
                    disabled={disabled || isBusy}
                    onClick={() => inputRef.current?.click()}
                  />
                </Attachment>
              )}

              {isBusy && !isUploading && (
                <span className="sr-only" role="status">
                  Removing image
                </span>
              )}
            </AttachmentGroup>

            {description && (
              <FieldDescription id={descriptionId}>
                {description}
              </FieldDescription>
            )}
            {(fieldState.invalid || operationError) && (
              <FieldError id={errorId}>
                {operationError ?? fieldState.error?.message}
              </FieldError>
            )}
          </Field>
        )
      }}
    />
  )
}

export default ImageField
