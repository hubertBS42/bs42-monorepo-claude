"use client"

import * as React from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Textarea } from "@workspace/ui/components/textarea"

interface TextareaFieldProps<
  T extends FieldValues,
> extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  control: Control<T>
  name: Path<T>
  label?: string
  description?: string
}

const TextareaField = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  id,
  ...textareaProps
}: TextareaFieldProps<T>) => {
  const inputId = id ?? String(name).replace(/[.[\]]+/g, "-")

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="grid gap-1">
          {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}

          <Textarea
            {...textareaProps}
            {...field}
            id={inputId}
            value={field.value ?? ""}
            aria-invalid={fieldState.invalid}
          />

          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export default TextareaField
