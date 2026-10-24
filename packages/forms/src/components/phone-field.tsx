"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Globe2 } from "lucide-react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"
import * as PhoneInput from "react-phone-number-input"
import flags from "react-phone-number-input/flags"

import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
} from "@workspace/ui/components/field"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@workspace/ui/components/command"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

import FieldLabelWithInfo from "./field-label-with-info"

interface PhoneFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  id?: string
  label?: string
  description?: string
  // More about the field, behind an ⓘ beside its label
  info?: string
  disabled?: boolean
  placeholder?: string
  defaultCountry?: PhoneInput.Country
  international?: boolean
  autoComplete?: string
}

interface CountryOption {
  label: string
  value?: PhoneInput.Country
}

interface CountrySelectProps {
  disabled?: boolean
  value?: PhoneInput.Country
  options: CountryOption[]
  onChange: (country?: PhoneInput.Country) => void
}

const countryNames = new Intl.DisplayNames(["en"], { type: "region" })

const PhoneField = <T extends FieldValues>({
  control,
  name,
  id,
  label,
  description,
  info,
  disabled = false,
  placeholder = "Enter phone number",
  defaultCountry,
  international = true,
  autoComplete = "tel",
}: PhoneFieldProps<T>) => {
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
            className="grid gap-1"
            data-disabled={disabled}
            data-invalid={fieldState.invalid}
          >
            {label && (
              <FieldLabelWithInfo htmlFor={inputId} label={label} info={info} />
            )}

            <PhoneInput.default
              id={inputId}
              name={field.name}
              className="flex"
              inputRef={field.ref}
              flagComponent={FlagComponent}
              flags={flags}
              countrySelectComponent={CountrySelect}
              inputComponent={PhoneInputTextInput}
              smartCaret
              value={typeof field.value === "string" ? field.value : ""}
              onChange={(value) => field.onChange(value ?? "")}
              onBlur={field.onBlur}
              disabled={disabled}
              placeholder={placeholder}
              autoComplete={autoComplete}
              international={international}
              defaultCountry={defaultCountry}
              countrySelectProps={{ "aria-label": "Select country" }}
              numberInputProps={{
                "aria-invalid": fieldState.invalid,
                "aria-describedby": describedBy,
                "aria-label": label ?? "Phone number",
              }}
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

const PhoneInputTextInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, ...props }, ref) => (
  <Input
    {...props}
    ref={ref}
    className={cn("min-w-0 flex-1 rounded-s-none rounded-e-md", className)}
  />
))
PhoneInputTextInput.displayName = "PhoneInputTextInput"

function FlagComponent({ country, countryName }: PhoneInput.FlagProps) {
  const Flag = flags[country]
  return (
    <span className="flex h-4 w-6 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted [&_svg:not([class*='size-'])]:size-full">
      {Flag ? (
        <Flag title={countryName} />
      ) : (
        <Globe2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
      )}
    </span>
  )
}

function CountrySelect({
  disabled = false,
  value,
  options,
  onChange,
}: CountrySelectProps) {
  const [open, setOpen] = React.useState(false)
  const selectedOption = options.find((option) => option.value === value)
  const selectedLabel =
    selectedOption?.label ??
    (value ? countryNames.of(value) : undefined) ??
    "International"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={`Country: ${selectedLabel}`}
            aria-expanded={open}
            className="rounded-s-md rounded-e-none border-e-0"
          />
        }
      >
        {value ? (
          <FlagComponent country={value} countryName={selectedLabel} />
        ) : (
          <Globe2 aria-hidden="true" className="size-4" />
        )}
        <ChevronsUpDown aria-hidden="true" className="size-3.5 opacity-50" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-72 gap-0 p-0"
        aria-label="Select a country"
      >
        <Command>
          <CommandInput placeholder="Search countries..." />
          <CommandList>
            <CommandEmpty>No countries found.</CommandEmpty>
            <CommandGroup>
              {options.map((option, index) => {
                const optionValue =
                  option.value ?? `international-${option.label}-${index}`
                const callingCode = option.value
                  ? PhoneInput.getCountryCallingCode(option.value)
                  : ""

                return (
                  <CommandItem
                    key={optionValue}
                    value={`${option.label} ${callingCode}`}
                    onSelect={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                  >
                    {option.value ? (
                      <FlagComponent
                        country={option.value}
                        countryName={option.label}
                      />
                    ) : (
                      <Globe2 aria-hidden="true" className="size-4" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    {callingCode && (
                      <CommandShortcut>+{callingCode}</CommandShortcut>
                    )}
                    <Check
                      aria-hidden="true"
                      className={cn(
                        "size-4",
                        option.value === value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default PhoneField
