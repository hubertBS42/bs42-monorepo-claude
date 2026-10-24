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
  FieldContent,
  FieldDescription,
  FieldError,
} from "@workspace/ui/components/field"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"

import FieldLabelWithInfo from "./field-label-with-info"

interface SwitchFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  id?: string
  label?: string
  description?: string
  // More about the field, behind an ⓘ beside its label
  info?: string
  disabled?: boolean
  size?: "sm" | "default"
  variant?: "default" | "card"
  className?: string
  onChange?: (checked: boolean) => void
}

const SwitchField = <T extends FieldValues>({
  control,
  name,
  id,
  description,
  info,
  label,
  disabled = false,
  size,
  variant = "default",
  className,
  onChange,
}: SwitchFieldProps<T>) => {
  const generatedId = React.useId()
  const inputId =
    id ?? `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`
  const isCard = variant === "card"

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

        const switchControl = (
          <Switch
            id={inputId}
            ref={field.ref}
            size={size}
            checked={field.value ?? false}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            aria-describedby={describedBy}
            onCheckedChange={(checked) => {
              field.onChange(checked)
              field.onBlur()
              onChange?.(checked)
            }}
          />
        )

        if (isCard) {
          return (
            <Field
              orientation="horizontal"
              className={cn("rounded-lg border p-3", className)}
              data-disabled={disabled}
              data-invalid={fieldState.invalid}
            >
              <FieldContent className="gap-y-1">
                {label && (
                  <FieldLabelWithInfo
                    htmlFor={inputId}
                    label={label}
                    info={info}
                  />
                )}
                {description && (
                  <FieldDescription id={descriptionId}>
                    {description}
                  </FieldDescription>
                )}
              </FieldContent>

              {switchControl}

              {fieldState.invalid && (
                <FieldError id={errorId} errors={[fieldState.error]} />
              )}
            </Field>
          )
        }

        return (
          <Field
            className={cn("grid gap-y-1", className)}
            data-disabled={disabled}
            data-invalid={fieldState.invalid}
          >
            <div className="flex items-center gap-x-2">
              {switchControl}

              {label && (
                <FieldLabelWithInfo
                  htmlFor={inputId}
                  label={label}
                  info={info}
                  className="font-light"
                />
              )}
            </div>
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

export default SwitchField
