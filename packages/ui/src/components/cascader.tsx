"use client"

import * as React from "react"
import { Check, ChevronRight, ChevronsUpDown, X } from "lucide-react"

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

// A picker for a tree (categories): a column per level, or a search across every level. Controlled by value and
// onChange, so a form field (CascaderField in @workspace/forms) and a table filter can both use it.

export type CascaderOption = {
  label: string
  value: string
  children?: CascaderOption[]
}

interface CascaderProps {
  id?: string
  value: string | null | undefined
  onChange: (value: string | null) => void
  options: CascaderOption[]
  disabledOptions?: string[]
  // Only options without children can be chosen; otherwise a parent can be too, and clicking it also opens its column
  leafOnly?: boolean
  clearable?: boolean
  disabled?: boolean
  placeholder?: string
  size?: "xs" | "sm" | "default"
  className?: string
  // Called when the popover closes, e.g. a form field's onBlur
  onClose?: () => void
  triggerRef?: React.Ref<HTMLButtonElement>
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  "aria-label"?: string
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

function Cascader({
  id,
  value,
  onChange,
  options,
  disabledOptions = [],
  leafOnly = true,
  clearable = false,
  disabled = false,
  placeholder = "Select an option",
  size = "default",
  className,
  onClose,
  triggerRef,
  ...aria
}: CascaderProps) {
  const [open, setOpen] = React.useState(false)
  const [path, setPath] = React.useState<CascaderOption[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const searchMode = searchTerm.length > 0

  const selectedPath = value ? findPathByValue(value, options) : null
  const displayValue = selectedPath
    ? selectedPath.map((item) => item.label).join(" / ")
    : null

  const getColumn = (level: number) =>
    level === 0 ? options : (path[level - 1]?.children ?? [])

  const handleSelect = (item: CascaderOption, level: number) => {
    setPath([...path.slice(0, level), item])
    if (isSelectable(item, leafOnly)) onChange(item.value)
  }

  const numColumns = path.length + 1

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (isOpen) {
          setPath(selectedPath ?? [])
        } else {
          setSearchTerm("")
          setPath([])
          onClose?.()
        }
      }}
    >
      {/* Its width comes from its container, never from the chosen path: without containment the path's full
          length widens every grid around it (a dialog's too), so it never truncates */}
      <div className={cn("relative contain-inline-size", className)}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              id={id}
              ref={triggerRef}
              variant="outline"
              role="combobox"
              disabled={disabled}
              aria-expanded={open}
              {...aria}
              className={cn(
                "w-full justify-between font-normal",
                displayValue && clearable && "pe-8",
                size === "sm" && "h-9 text-xs",
                size === "xs" && "h-8"
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
              onChange(null)
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
                    const isSelected = value === item.value
                    const isDisabled = disabledOptions.includes(item.value)

                    return (
                      <CommandItem
                        key={item.value}
                        value={fullPath}
                        disabled={isDisabled}
                        className="rounded-none"
                        onSelect={() => {
                          onChange(item.value)
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
                        const isActiveBranch = path[level]?.value === item.value
                        const isFinalSelected = value === item.value
                        const isDisabled = disabledOptions.includes(item.value)
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
                            onSelect={() => handleSelect(item, level)}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {item.label}
                            </span>
                            <CommandShortcut className="flex items-center gap-1">
                              {isFinalSelected && (
                                <Check aria-hidden="true" className="size-4" />
                              )}
                              {item.children && item.children.length > 0 && (
                                <ChevronRight
                                  aria-hidden="true"
                                  className={cn(
                                    "size-4",
                                    leafOnly ? "opacity-30" : "opacity-50"
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
  )
}

export { Cascader }
