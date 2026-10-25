"use client"

import { useState } from "react"
import { CirclePlus } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@workspace/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Separator } from "@workspace/ui/components/separator"

// A choice in the list. `depth` indents a tree's levels, and `keywords` is what a search matches (a category's whole
// path, so typing its parent finds it too).
export interface FacetOption {
  label: string
  value: string
  depth?: number
  keywords?: string[]
}

interface FacetedFilterProps {
  id: string
  title: string
  options: FacetOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

// Lists longer than this get a search box
const SEARCHABLE_FROM = 8

// After shadcn's data table toolbar: a dashed button naming the filter, showing its choice once one is made, with the
// choices in a list below it. One choice at a time, as the URL holds one value; choosing it again clears it.
const FacetedFilter = ({ id, title, options, value, onChange, disabled }: FacetedFilterProps) => {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  const choose = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        render={
          <Button variant="outline" size="sm" className="h-8 border-dashed" disabled={disabled}>
            <CirclePlus />
            {title}
            {selected && (
              <>
                <Separator orientation="vertical" className="mx-0.5 h-4" />
                <Badge variant="secondary" className="max-w-40 truncate rounded-sm px-1 font-normal">
                  {selected.label}
                </Badge>
              </>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-64 p-0" align="start">
        {/* Matched on the labels, not the ids cmdk would otherwise search too */}
        <Command filter={(_, search, keywords) => ((keywords ?? []).join(" ").toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          {options.length >= SEARCHABLE_FROM && <CommandInput placeholder={title} />}
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                // CommandItem draws the check on the right from data-checked, as in a combobox: one choice, not a checklist.
                // A tree's levels indent the whole row, so the top level lines up with the search box.
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={option.keywords ?? [option.label]}
                  onSelect={() => choose(option.value === value ? "" : option.value)}
                  data-checked={option.value === value}
                  style={option.depth ? { paddingInlineStart: `calc(0.5rem + ${option.depth}rem)` } : undefined}
                >
                  <span className="min-w-0 flex-1 truncate" title={option.label}>
                    {option.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {selected && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem value="__clear" keywords={[]} onSelect={() => choose("")} className="justify-center">
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default FacetedFilter
