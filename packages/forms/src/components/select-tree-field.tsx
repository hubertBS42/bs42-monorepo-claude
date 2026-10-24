"use client"

import * as React from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Field,
  FieldDescription,
  FieldError,
} from "@workspace/ui/components/field"

import FieldLabelWithInfo from "./field-label-with-info"

export type TreeSelectOption = {
  label: string
  value: string
  children?: TreeSelectOption[]
}

type FlatOption = {
  label: string
  value: string
  depth: number
  isBranch: boolean
}

interface SelectTreeFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  id?: string
  label?: string
  placeholder?: string
  size?: "sm" | "default"
  description?: string
  // More about the field, behind an ⓘ beside its label
  info?: string
  className?: string
  disabled?: boolean
  options: TreeSelectOption[]
  disabledOptions?: string[]
  branchesSelectable?: boolean
  side?: "top" | "bottom" | "left" | "right"
}

const flattenTree = (items: TreeSelectOption[], depth = 0): FlatOption[] => {
  const result: FlatOption[] = []

  for (const item of items) {
    const isBranch = Boolean(item.children && item.children.length > 0)
    result.push({ label: item.label, value: item.value, depth, isBranch })
    if (item.children) {
      result.push(...flattenTree(item.children, depth + 1))
    }
  }

  return result
}

const SelectTreeField = <T extends FieldValues>({
  control,
  name,
  id,
  description,
  info,
  label,
  side,
  className,
  placeholder = "Select an option",
  options,
  disabledOptions = [],
  branchesSelectable = true,
  disabled = false,
  size,
}: SelectTreeFieldProps<T>) => {
  const generatedId = React.useId()
  const inputId =
    id ?? `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`

  const flatOptions = React.useMemo(() => flattenTree(options), [options])

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
            className={className ?? "grid gap-1"}
            data-disabled={disabled}
            data-invalid={fieldState.invalid}
          >
            {label && (
              <FieldLabelWithInfo htmlFor={inputId} label={label} info={info} />
            )}

            <Select
              items={flatOptions}
              value={field.value ?? ""}
              disabled={disabled}
              onValueChange={(value) => {
                field.onChange(value)
                field.onBlur()
              }}
            >
              <SelectTrigger
                id={inputId}
                ref={field.ref}
                size={size}
                className="w-full"
                aria-invalid={fieldState.invalid}
                aria-describedby={describedBy}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>

              <SelectContent side={side}>
                {flatOptions.map((option) => {
                  const isDisabled =
                    disabledOptions.includes(option.value) ||
                    (option.isBranch && !branchesSelectable)

                  return (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={isDisabled}
                      className={option.isBranch ? "font-medium" : undefined}
                      style={{ paddingLeft: `${8 + option.depth * 16}px` }}
                    >
                      {option.label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

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

export default SelectTreeField
