"use client"

import * as React from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"
import { Eye, EyeClosed } from "lucide-react"

import {
  Field,
  FieldDescription,
  FieldError,
} from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"

import FieldLabelWithInfo from "./field-label-with-info"

interface PasswordFieldProps<T extends FieldValues> extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  control: Control<T>
  name: Path<T>
  label?: string
  description?: string
  // More about the field, behind an ⓘ beside its label
  info?: string
  resetPasswordSlot?: React.ReactNode
}

const PasswordField = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  info,
  id,
  resetPasswordSlot,
  ...inputProps
}: PasswordFieldProps<T>) => {
  const generatedId = React.useId()
  const inputId = id ?? `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="grid gap-1">
          {(label || resetPasswordSlot) && (
            <div className="flex items-center justify-between gap-2">
              {label && (
                <FieldLabelWithInfo htmlFor={inputId} label={label} info={info} />
              )}
              {resetPasswordSlot}
            </div>
          )}

          <InputGroup>
            <InputGroupInput
              {...field}
              id={inputId}
              aria-invalid={fieldState.invalid}
              type={showPassword ? "text" : "password"}
              {...inputProps}
            />
            <InputGroupAddon align={"inline-end"}>
              <InputGroupButton
                aria-label={showPassword ? "Hide" : "Show"}
                title={showPassword ? "Hide" : "Show"}
                size="icon-xs"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeClosed /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export default PasswordField
