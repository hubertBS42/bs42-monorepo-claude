"use client"

import * as React from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import { Field, FieldError } from "@workspace/ui/components/field"
import { Textarea } from "@workspace/ui/components/textarea"

import FieldHint from "./field-hint"
import FieldLabelWithInfo from "./field-label-with-info"

interface TextareaFieldProps<
  T extends FieldValues,
> extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  control: Control<T>
  name: Path<T>
  label?: string
  description?: string
  // More about the field, behind an ⓘ beside its label
  info?: string
  // Show "12 / 100" under the field; needs maxLength
  showCount?: boolean
}

const TextareaField = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  info,
  showCount = false,
  id,
  ...textareaProps
}: TextareaFieldProps<T>) => {
  const generatedId = React.useId()
  const inputId = id ?? `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="grid gap-1">
          {label && (
            <FieldLabelWithInfo htmlFor={inputId} label={label} info={info} />
          )}

          <Textarea
            {...textareaProps}
            {...field}
            id={inputId}
            value={field.value ?? ""}
            aria-invalid={fieldState.invalid}
          />

          <FieldHint
            description={description}
            count={
              showCount && textareaProps.maxLength !== undefined
                ? {
                    length: String(field.value ?? "").length,
                    max: textareaProps.maxLength,
                  }
                : undefined
            }
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export default TextareaField
