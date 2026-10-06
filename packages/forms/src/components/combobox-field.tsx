"use client"

import * as React from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"

export interface ComboboxOption {
  label: string
  value: string
  disabled?: boolean
}

interface ComboboxFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  id?: string
  label?: string
  placeholder?: string
  autoComplete?: string
  description?: string
  options: ComboboxOption[]
  disabled?: boolean
  emptyMessage?: string
  modal?: boolean
  onValueChange?: (value: string) => void
}

const ComboboxField = <T extends FieldValues>({
  control,
  name,
  id,
  label,
  placeholder = "Select an option",
  autoComplete = "off",
  description,
  options,
  disabled = false,
  emptyMessage = "No options found.",
  modal = false,
  onValueChange,
}: ComboboxFieldProps<T>) => {
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
        const fieldValue = String(field.value ?? "")
        const selectedOption =
          options.find((option) => option.value === fieldValue) ??
          (fieldValue ? { value: fieldValue, label: fieldValue } : null)
        const describedBy =
          [
            description ? descriptionId : undefined,
            fieldState.invalid ? errorId : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined

        return (
          <Field
            className="grid gap-1"
            data-disabled={disabled}
            data-invalid={fieldState.invalid}
          >
            {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}

            <Combobox
              items={options}
              value={selectedOption}
              disabled={disabled}
              itemToStringLabel={(option) => option.label}
              itemToStringValue={(option) => option.value}
              onValueChange={(option) => {
                if (!option) return

                field.onChange(option.value)
                onValueChange?.(option.value)
              }}
              modal={modal}
              onOpenChange={(open) => {
                if (!open) field.onBlur()
              }}
            >
              <ComboboxInput
                id={inputId}
                placeholder={placeholder}
                autoComplete={autoComplete}
                disabled={disabled}
                aria-invalid={fieldState.invalid}
                aria-describedby={describedBy}
                onBlur={field.onBlur}
              />

              <ComboboxContent>
                <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
                <ComboboxList>
                  {(option: ComboboxOption) => (
                    <ComboboxItem
                      key={option.value}
                      value={option}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>

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

export default ComboboxField
