import * as React from "react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"

interface NumberInputFieldProps<T extends FieldValues> extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange"
> {
  control: Control<T>
  name: Path<T>
  label?: string
  description?: string
  min?: number
  max?: number
  step?: number
  prependText?: string
  onValueChange?: (value: number | "") => void
}

const NumberInputField = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  id,
  min = 0,
  max,
  step = 1,
  prependText,
  onValueChange,
  ...inputProps
}: NumberInputFieldProps<T>) => {
  const generatedId = React.useId()
  const inputId = id ?? `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`

  const roundToPrecision = React.useCallback(
    (value: number, stepValue: number) => {
      const stepString = stepValue.toString()
      const decimalPlaces = stepString.includes(".")
        ? (stepString.split(".")[1]?.length ?? 0)
        : 0
      const multiplier = 10 ** decimalPlaces

      return Math.round(value * multiplier) / multiplier
    },
    []
  )

  const clampValue = React.useCallback(
    (value: number) => {
      let nextValue = value

      if (min !== undefined && nextValue < min) {
        nextValue = min
      }

      if (max !== undefined && nextValue > max) {
        nextValue = max
      }

      return nextValue
    },
    [max, min]
  )

  const normalizeValue = React.useCallback(
    (value: number) => clampValue(roundToPrecision(value, step)),
    [clampValue, roundToPrecision, step]
  )

  // Typed values are kept as-is while editing. Rounding and clamping wait until blur,
  // otherwise min={10} would turn the "5" of "50" into 10 before the user could finish.
  const handleValueChange = React.useCallback(
    (value: number | "", onChange: (value: number | "") => void) => {
      onChange(value)
      onValueChange?.(value)
    },
    [onValueChange]
  )

  const handleBlur = React.useCallback(
    (value: unknown, onChange: (value: number | "") => void) => {
      if (typeof value !== "number" || Number.isNaN(value)) return

      const nextValue = normalizeValue(value)
      if (nextValue !== value) {
        onChange(nextValue)
        onValueChange?.(nextValue)
      }
    },
    [normalizeValue, onValueChange]
  )

  const handleStep = React.useCallback(
    (
      direction: "up" | "down",
      currentValue: number | "",
      onChange: (value: number | "") => void
    ) => {
      const safeCurrent = typeof currentValue === "number" ? currentValue : 0
      const delta = direction === "up" ? step : -step
      const nextValue = normalizeValue(safeCurrent + delta)

      onChange(nextValue)
      onValueChange?.(nextValue)
    },
    [normalizeValue, onValueChange, step]
  )

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const currentValue =
          typeof field.value === "number"
            ? field.value
            : Number(field.value ?? 0)

        return (
          <Field data-invalid={fieldState.invalid} className="grid gap-1">
            {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}

            <InputGroup className="relative overflow-hidden">
              {prependText && (
                <InputGroupAddon>
                  <InputGroupText>{prependText}</InputGroupText>
                </InputGroupAddon>
              )}

              <InputGroupInput
                {...inputProps}
                {...field}
                id={inputId}
                type="number"
                min={min}
                max={max}
                step={step}
                value={field.value ?? ""}
                aria-invalid={fieldState.invalid}
                onChange={(event) => {
                  const rawValue = event.target.value

                  if (rawValue === "") {
                    handleValueChange("", field.onChange)
                    return
                  }

                  const parsedValue = Number(rawValue)

                  if (Number.isNaN(parsedValue)) {
                    handleValueChange("", field.onChange)
                    return
                  }

                  handleValueChange(parsedValue, field.onChange)
                }}
                onBlur={() => {
                  handleBlur(field.value, field.onChange)
                  field.onBlur()
                }}
              />

              <InputGroupAddon
                align="inline-end"
                className="flex h-[calc(100%+2px)] flex-col gap-0 p-0"
              >
                <InputGroupButton
                  type="button"
                  variant={"outline"}
                  aria-label="Increase value"
                  size="icon-sm"
                  title="Increase"
                  className="flex-1 rounded-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleStep("up", field.value, field.onChange)}
                  disabled={inputProps.disabled || (max !== undefined && currentValue >= max)}
                >
                  <ChevronUpIcon className="size-3.5" />
                </InputGroupButton>
                <InputGroupButton
                  type="button"
                  variant={"outline"}
                  aria-label="Decrease value"
                  size="icon-sm"
                  title="Decrease"
                  className="flex-1 rounded-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() =>
                    handleStep("down", field.value, field.onChange)
                  }
                  disabled={inputProps.disabled || (min !== undefined && currentValue <= min)}
                >
                  <ChevronDownIcon className="size-3.5" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>

            {description && <FieldDescription>{description}</FieldDescription>}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}

export default NumberInputField
