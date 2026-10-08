"use client"

import * as React from "react"
import { FileText, Upload, X } from "lucide-react"
import { Controller, type Control, type FieldPathValue, type FieldValues, type Path, type UseFormClearErrors } from "react-hook-form"
import type { DocumentItem } from "@workspace/contracts"

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
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { Spinner } from "@workspace/ui/components/spinner"

interface DocumentFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  label?: string
  description?: string
  className?: string
  disabled?: boolean
  maxFiles?: number
  sizeLimit?: number
  accept?: string
  defaultValues?: DocumentItem[]
  clearErrors?: UseFormClearErrors<T>
  onAdd: (files: FileList) => Promise<DocumentItem[]>
  onRemove: (url: string) => Promise<void>
}

function getDocuments(value: unknown): DocumentItem[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is DocumentItem => typeof item === "object" && item !== null && "name" in item && typeof item.name === "string" && "url" in item && typeof item.url === "string")
  }
  return []
}

function isAcceptedFile(file: File, accept: string): boolean {
  const rules = accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)

  if (rules.length === 0) return true

  const fileName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()

  return rules.some((rule) => {
    if (rule.startsWith(".")) return fileName.endsWith(rule)
    if (rule.endsWith("/*")) return mimeType.startsWith(rule.slice(0, -1))
    return mimeType === rule
  })
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

const DocumentField = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled = false,
  maxFiles = 1,
  sizeLimit = 10_240,
  accept = ".pdf,application/pdf",
  defaultValues,
  clearErrors,
  onAdd,
  onRemove,
}: DocumentFieldProps<T>) => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const generatedId = React.useId()
  const inputId = `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`
  const labelId = `${inputId}-label`
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`
  const [isUploading, setIsUploading] = React.useState(false)
  const [removingIndex, setRemovingIndex] = React.useState<number | null>(null)
  const [operationError, setOperationError] = React.useState<string | null>(null)
  const fileLimit = Number.isFinite(maxFiles) ? Math.max(1, Math.floor(maxFiles)) : 1
  const initialValue = defaultValues ?? []

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <Controller
      control={control}
      name={name}
      defaultValue={initialValue as FieldPathValue<T, Path<T>>}
      render={({ field, fieldState }) => {
        const documents = getDocuments(field.value)
        const isBusy = isUploading || removingIndex !== null
        const canAddFile = !disabled && !isBusy && documents.length < fileLimit
        const describedBy = [description ? descriptionId : undefined, fieldState.invalid || operationError ? errorId : undefined].filter(Boolean).join(" ") || undefined

        const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
          const selectedFiles = event.currentTarget.files
          if (!selectedFiles?.length) return

          const selected = Array.from(selectedFiles)
          const availableSlots = fileLimit - documents.length

          try {
            const invalidFile = selected.find((file) => !isAcceptedFile(file, accept))
            if (invalidFile) {
              throw new Error(`${invalidFile.name} is not an accepted file type.`)
            }

            const oversizedFile = selected.find((file) => file.size > sizeLimit * 1024)
            if (oversizedFile) {
              throw new Error(`Each file must be ${sizeLimit} KB or smaller.`)
            }

            if (selected.length > availableSlots) {
              throw new Error(`You can attach up to ${fileLimit} file${fileLimit === 1 ? "" : "s"}.`)
            }

            setOperationError(null)
            clearErrors?.(name)
            setIsUploading(true)
            const uploadedDocuments = await onAdd(selectedFiles)

            if (
              !Array.isArray(uploadedDocuments) ||
              uploadedDocuments.length !== selected.length ||
              uploadedDocuments.some((document) => typeof document?.name !== "string" || !document.name || typeof document.url !== "string" || !document.url)
            ) {
              throw new Error("The upload did not return a name and URL for every selected file.")
            }

            field.onChange([...documents, ...uploadedDocuments])
          } catch (error) {
            setOperationError(getErrorMessage(error, "Unable to upload the selected files."))
          } finally {
            setIsUploading(false)
            clearInput()
          }
        }

        const handleRemove = async (index: number) => {
          const document = documents[index]
          if (!document) return

          setOperationError(null)
          clearErrors?.(name)
          setRemovingIndex(index)

          try {
            await onRemove(document.url)
            const remainingDocuments = documents.filter((_, fileIndex) => fileIndex !== index)
            field.onChange(remainingDocuments)
          } catch (error) {
            setOperationError(getErrorMessage(error, "Unable to remove this file."))
          } finally {
            setRemovingIndex(null)
          }
        }

        return (
          <Field className="grid gap-y-1" data-disabled={disabled} data-invalid={fieldState.invalid || Boolean(operationError)}>
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
              multiple={fileLimit > 1}
              disabled={disabled || isBusy || documents.length >= fileLimit}
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onBlur={field.onBlur}
              onChange={handleFileChange}
            />

            <AttachmentGroup aria-labelledby={label ? labelId : undefined} aria-describedby={describedBy} className={className}>
              {documents.map((document, index) => {
                const fileName = document.name

                return (
                  <Attachment key={`${document.url}-${index}`} state={removingIndex === index ? "processing" : "done"}>
                    <AttachmentMedia>{removingIndex === index ? <Spinner /> : <FileText />}</AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle title={fileName}>
                        <a href={document.url} target="_blank" rel="noreferrer" className="block max-w-[24ch] truncate">
                          {fileName}
                        </a>
                      </AttachmentTitle>
                      <AttachmentDescription>{removingIndex === index ? "Removing..." : "Uploaded file"}</AttachmentDescription>
                    </AttachmentContent>
                    <AttachmentActions>
                      <AttachmentAction type="button" aria-label={`Remove ${fileName}`} title={`Remove ${fileName}`} disabled={isBusy || disabled} onClick={() => void handleRemove(index)}>
                        <X />
                      </AttachmentAction>
                    </AttachmentActions>
                  </Attachment>
                )
              })}

              {isUploading && (
                <Attachment state="uploading" aria-live="polite">
                  <AttachmentMedia>
                    <Spinner />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>Uploading files</AttachmentTitle>
                    <AttachmentDescription>Please wait...</AttachmentDescription>
                  </AttachmentContent>
                </Attachment>
              )}

              {canAddFile && (
                <Attachment state="idle">
                  <AttachmentMedia>
                    <Upload className="text-muted-foreground" />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>Add file</AttachmentTitle>
                    <AttachmentDescription>Up to {sizeLimit} KB</AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentTrigger aria-label={`Add ${label ?? "file"}`} aria-describedby={describedBy} disabled={disabled || isBusy} onClick={() => inputRef.current?.click()} />
                </Attachment>
              )}
            </AttachmentGroup>

            {description && <FieldDescription id={descriptionId}>{description}</FieldDescription>}
            {(fieldState.invalid || operationError) && <FieldError id={errorId}>{operationError ?? fieldState.error?.message}</FieldError>}
          </Field>
        )
      }}
    />
  )
}

export default DocumentField
