"use client"

import * as React from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import {
  Cascader,
  type CascaderOption,
} from "@workspace/ui/components/cascader"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { cn } from "@workspace/ui/lib/utils"

export type { CascaderOption }

interface CascaderFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  id?: string
  label?: string
  placeholder?: string
  size?: "sm" | "default"
  description?: string
  className?: string
  disabled?: boolean
  options: CascaderOption[]
  disabledOptions?: string[]
  leafOnly?: boolean
  clearable?: boolean
}

// The Cascader as a react-hook-form field, with its label, description and error
const CascaderField = <T extends FieldValues>({
  control,
  name,
  id,
  label,
  disabled = false,
  placeholder = "Select an option",
  description,
  options,
  disabledOptions = [],
  size = "default",
  className,
  leafOnly = true,
  clearable = false,
}: CascaderFieldProps<T>) => {
  const generatedId = React.useId()
  const inputId =
    id ?? `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const describedBy =
          [
            description ? descriptionId : undefined,
            fieldState.invalid ? errorId : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined

        return (
          <Field
            className={cn("grid gap-1", className)}
            data-disabled={disabled}
            data-invalid={fieldState.invalid}
          >
            {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}

            <Cascader
              id={inputId}
              triggerRef={field.ref}
              value={field.value}
              onChange={field.onChange}
              onClose={field.onBlur}
              options={options}
              disabledOptions={disabledOptions}
              leafOnly={leafOnly}
              clearable={clearable}
              disabled={disabled}
              placeholder={placeholder}
              size={size}
              aria-invalid={fieldState.invalid}
              aria-describedby={describedBy}
            />

            {description && (
              <FieldDescription id={descriptionId}>
                {description}
              </FieldDescription>
            )}
            {fieldState.invalid && (
              <FieldError id={errorId} errors={[fieldState.error]} />
            )}
          </Field>
        )
      }}
    />
  )
}

export default CascaderField
