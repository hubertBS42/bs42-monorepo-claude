import * as React from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import {
  Field,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import FieldHint from "./field-hint"

interface TextInputFieldProps<
  T extends FieldValues,
> extends React.InputHTMLAttributes<HTMLInputElement> {
  control: Control<T>
  name: Path<T>
  label?: string
  description?: string
  // Show "12 / 100" under the field; needs maxLength
  showCount?: boolean
  autoComplete?: string
}

const TextInputField = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  autoComplete = "off",
  showCount = false,
  id,
  ...inputProps
}: TextInputFieldProps<T>) => {
  const inputId = id ?? String(name).replace(/[.[\]]+/g, "-")

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="grid gap-1">
          {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}

          <Input
            autoComplete={autoComplete}
            {...inputProps}
            {...field}
            id={inputId}
            value={field.value ?? ""}
            aria-invalid={fieldState.invalid}
          />

          <FieldHint
            description={description}
            count={
              showCount && inputProps.maxLength !== undefined
                ? {
                    length: String(field.value ?? "").length,
                    max: inputProps.maxLength,
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

export default TextInputField
