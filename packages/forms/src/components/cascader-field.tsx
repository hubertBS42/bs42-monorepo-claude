"use client"

import * as React from "react"
import { Check, ChevronRight, ChevronsUpDown, X } from "lucide-react"
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@workspace/ui/components/command"
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
import { cn } from "@workspace/ui/lib/utils"

export type CascaderOption = {
  label: string
  value: string
  children?: CascaderOption[]
}

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

type SearchResult = {
  item: CascaderOption
  fullPath: string
}

const isSelectable = (item: CascaderOption, leafOnly: boolean) =>
  !leafOnly || !item.children || item.children.length === 0

const findPathByValue = (
  value: string,
  items: CascaderOption[],
  currentPath: CascaderOption[] = []
): CascaderOption[] | null => {
  for (const item of items) {
    const nextPath = [...currentPath, item]
    if (item.value === value) return nextPath
    if (item.children) {
      const result = findPathByValue(value, item.children, nextPath)
      if (result) return result
    }
  }
  return null
}

const searchOptions = (
  items: CascaderOption[],
  term: string,
  leafOnly: boolean,
  parentLabels: string[] = []
): SearchResult[] => {
  const results: SearchResult[] = []

  for (const item of items) {
    const labels = [...parentLabels, item.label]

    if (
      isSelectable(item, leafOnly) &&
      item.label.toLowerCase().includes(term.toLowerCase())
    ) {
      results.push({ item, fullPath: labels.join(" / ") })
    }

    if (item.children) {
      results.push(...searchOptions(item.children, term, leafOnly, labels))
    }
  }

  return results
}

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

  const [open, setOpen] = React.useState(false)
  const [path, setPath] = React.useState<CascaderOption[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const searchMode = searchTerm.length > 0

  const getDisplayValue = (value: string | null | undefined) => {
    if (!value) return null
    const fullPath = findPathByValue(value, options)
    return fullPath ? fullPath.map((item) => item.label).join(" / ") : null
  }

  const getColumn = (level: number) =>
    level === 0 ? options : (path[level - 1]?.children ?? [])

  const handleSelect = (
    item: CascaderOption,
    level: number,
    onChange: (value: string | null) => void
  ) => {
    setPath([...path.slice(0, level), item])
    if (isSelectable(item, leafOnly)) onChange(item.value)
  }

  const numColumns = path.length + 1

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
        const displayValue = getDisplayValue(field.value)

        return (
          <Field
            className={cn("grid gap-1", className)}
            data-disabled={disabled}
            data-invalid={fieldState.invalid}
          >
            {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}

            <Popover
              open={open}
              onOpenChange={(isOpen) => {
                setOpen(isOpen)
                if (isOpen) {
                  setPath(
                    field.value
                      ? (findPathByValue(field.value, options) ?? [])
                      : []
                  )
                } else {
                  setSearchTerm("")
                  setPath([])
                  field.onBlur()
                }
              }}
            >
              <div className="relative">
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      id={inputId}
                      ref={field.ref}
                      variant="outline"
                      role="combobox"
                      disabled={disabled}
                      aria-expanded={open}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={describedBy}
                      className={cn(
                        "w-full justify-between font-normal",
                        displayValue && clearable && "pe-8",
                        size === "sm" && "h-9 text-xs"
                      )}
                    />
                  }
                >
                  <span
                    className={cn(
                      "min-w-0 truncate text-left",
                      !displayValue && "text-muted-foreground"
                    )}
                  >
                    {displayValue ?? placeholder}
                  </span>
                  {!(displayValue && clearable) && (
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                  )}
                </PopoverTrigger>
                {displayValue && clearable && (
                  <button
                    type="button"
                    aria-label="Clear selection"
                    disabled={disabled}
                    className="inset-e-2 absolute top-1/2 -translate-y-1/2 rounded-xs opacity-50 hover:opacity-100 disabled:pointer-events-none"
                    onClick={(event) => {
                      event.stopPropagation()
                      setPath([])
                      field.onChange(null)
                    }}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <PopoverContent
                align="start"
                className="w-auto max-w-[min(90vw,48rem)] gap-0 p-0"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search..."
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                  />
                  <CommandList className="px-1 pt-1.25">
                    <CommandEmpty>No results found.</CommandEmpty>
                    {searchMode ? (
                      <CommandGroup>
                        {searchOptions(options, searchTerm, leafOnly).map(
                          ({ item, fullPath }) => {
                            const isSelected = field.value === item.value
                            const isDisabled = disabledOptions.includes(
                              item.value
                            )

                            return (
                              <CommandItem
                                key={item.value}
                                value={fullPath}
                                disabled={isDisabled}
                                className="rounded-none"
                                onSelect={() => {
                                  field.onChange(item.value)
                                  setOpen(false)
                                }}
                              >
                                <Check
                                  aria-hidden="true"
                                  className={cn(
                                    "size-4",
                                    isSelected ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="min-w-0 flex-1 truncate">
                                  {fullPath}
                                </span>
                              </CommandItem>
                            )
                          }
                        )}
                      </CommandGroup>
                    ) : (
                      <div className="flex max-h-75">
                        {Array.from({ length: numColumns }).map((_, level) => {
                          const items = getColumn(level)
                          if (items.length === 0) return null

                          return (
                            <CommandGroup
                              key={level}
                              className="min-w-45 overflow-y-auto border-e-0 p-0"
                            >
                              {items.map((item) => {
                                const isActiveBranch =
                                  path[level]?.value === item.value
                                const isFinalSelected =
                                  field.value === item.value
                                const isDisabled = disabledOptions.includes(
                                  item.value
                                )
                                const selectable = isSelectable(item, leafOnly)

                                return (
                                  <CommandItem
                                    key={item.value}
                                    value={item.value}
                                    disabled={isDisabled}
                                    className={cn(
                                      "rounded-none",
                                      isActiveBranch && "bg-accent",
                                      !selectable && "cursor-default"
                                    )}
                                    onSelect={() =>
                                      handleSelect(item, level, field.onChange)
                                    }
                                  >
                                    <span className="min-w-0 flex-1 truncate">
                                      {item.label}
                                    </span>
                                    <CommandShortcut className="flex items-center gap-1">
                                      {isFinalSelected && (
                                        <Check
                                          aria-hidden="true"
                                          className="size-4"
                                        />
                                      )}
                                      {item.children &&
                                        item.children.length > 0 && (
                                          <ChevronRight
                                            aria-hidden="true"
                                            className={cn(
                                              "size-4",
                                              leafOnly
                                                ? "opacity-30"
                                                : "opacity-50"
                                            )}
                                          />
                                        )}
                                    </CommandShortcut>
                                  </CommandItem>
                                )
                              })}
                            </CommandGroup>
                          )
                        })}
                      </div>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

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
