"use client"

import * as React from "react"
import { CalendarIcon, XIcon } from "lucide-react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

interface DateFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  id?: string
  label?: string
  description?: string
  placeholder?: string
  disabled?: boolean
  disabledDates?: React.ComponentProps<typeof Calendar>["disabled"]
  clearable?: boolean
  captionLayout?: React.ComponentProps<typeof Calendar>["captionLayout"]
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

const DateField = <T extends FieldValues>({
  control,
  name,
  id,
  label,
  description,
  placeholder = "Pick a date",
  disabled = false,
  disabledDates,
  clearable = true,
  captionLayout = "label",
}: DateFieldProps<T>) => {
  const generatedId = React.useId()
  const inputId =
    id ?? `${generatedId}-${String(name).replace(/[.[\]]+/g, "-")}`
  const labelId = `${inputId}-label`
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`
  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState(() => new Date())

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selectedDate = isValidDate(field.value) ? field.value : null
        const describedBy =
          [
            description ? descriptionId : undefined,
            fieldState.invalid ? errorId : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined

        const clearDate = () => {
          field.onChange(null)
          field.onBlur()
          setOpen(false)
        }

        return (
          <Field
            className="grid gap-1"
            data-disabled={disabled}
            data-invalid={fieldState.invalid}
          >
            {label && (
              <FieldLabel id={labelId} htmlFor={inputId} className="w-fit">
                {label}
              </FieldLabel>
            )}

            <div className="relative">
              <Popover
                open={open}
                onOpenChange={(nextOpen) => {
                  // Open on the selected date's month, or today's when nothing is selected
                  if (nextOpen) setMonth(selectedDate ?? new Date())
                  setOpen(nextOpen)
                  if (!nextOpen) field.onBlur()
                }}
              >
                <PopoverTrigger
                  render={
                    <Button
                      id={inputId}
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      aria-labelledby={label ? labelId : undefined}
                      aria-describedby={describedBy}
                      aria-invalid={fieldState.invalid}
                      className="w-full justify-start text-left font-normal"
                    />
                  }
                >
                  <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
                  {selectedDate ? (
                    dateFormatter.format(selectedDate)
                  ) : (
                    <span className="text-muted-foreground">{placeholder}</span>
                  )}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate ?? undefined}
                    month={month}
                    onMonthChange={setMonth}
                    onSelect={(date) => {
                      if (!date) return
                      field.onChange(date)
                      setMonth(date)
                      setOpen(false)
                      field.onBlur()
                    }}
                    disabled={disabledDates}
                    captionLayout={captionLayout}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>

              {clearable && selectedDate && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Clear ${label ?? "date"}`}
                  className="absolute top-0 right-0 h-full"
                  onClick={clearDate}
                >
                  <XIcon className="size-4" />
                </Button>
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

export default DateField
