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
} from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import FieldLabelWithInfo from "./field-label-with-info"

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectFieldProps<T extends FieldValues> extends Omit<
  React.ComponentProps<typeof SelectTrigger>,
  "value" | "defaultValue" | "onValueChange"
> {
  control: Control<T>
  name: Path<T>
  label?: string
  description?: string
  // More about the field, behind an ⓘ beside its label
  info?: string
  placeholder?: string
  options: SelectOption[]
}

const SelectField = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  info,
  placeholder = "Select an option",
  options,
  ...triggerProps
}: SelectFieldProps<T>) => {
  const generatedId = React.useId()
  const inputId = `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="grid gap-1">
          {label && (
            <FieldLabelWithInfo htmlFor={inputId} label={label} info={info} />
          )}

          <Select
            items={options}
            name={field.name}
            value={String(field.value ?? "")}
            onValueChange={(value) => field.onChange(value)}
            onOpenChange={(open) => {
              if (!open) field.onBlur()
            }}
          >
            <SelectTrigger
              {...triggerProps}
              id={inputId}
              aria-invalid={fieldState.invalid}
              className="w-full"
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export default SelectField
