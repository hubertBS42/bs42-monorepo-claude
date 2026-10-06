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
import { Input } from "@workspace/ui/components/input"

interface TextInputFieldProps<
  T extends FieldValues,
> extends React.InputHTMLAttributes<HTMLInputElement> {
  control: Control<T>
  name: Path<T>
  label?: string
  description?: string
  autoComplete?: string
}

const TextInputField = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  autoComplete = "off",
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

          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export default TextInputField
