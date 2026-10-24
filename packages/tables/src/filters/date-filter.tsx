"use client"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { format, isValid, parse } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"

// The URL holds a plain day (yyyy-MM-dd), not a timestamp, so the server render and the browser always show the
// same date whatever their time zones. The loader decides what the day means (e.g. createdAt within it).
const DAY_FORMAT = "yyyy-MM-dd"

interface DateFilterProps {
  id: string
  filterKey: string
  // Shown until a day is picked; the filter's name, as the toolbar has no labels
  placeholder?: string
  values: Record<string, string>
  setValues: (v: Record<string, string>) => void
  applyFilters: (overrides?: Record<string, string>) => void
  isPending?: boolean
}

const DateFilter = ({ id, filterKey, placeholder = "Pick a date", values, setValues, applyFilters, isPending }: DateFilterProps) => {
  const raw = values[filterKey]
  const parsed = raw ? parse(raw, DAY_FORMAT, new Date()) : undefined
  const date = parsed && isValid(parsed) ? parsed : undefined

  const handleSelect = (day: Date | undefined) => {
    const newValues = { ...values, [filterKey]: day ? format(day, DAY_FORMAT) : "" }
    setValues(newValues)
    applyFilters(newValues)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleSelect(undefined)
  }

  return (
    <div className="relative">
      <Popover>
        <PopoverTrigger
          id={id}
          render={
            <Button variant="outline" disabled={isPending} className={cn("h-8 w-full justify-start text-left font-light", !date && "text-muted-foreground", date && "pe-8")}>
              <CalendarIcon className="mr-px size-4 opacity-50" />
              {date ? format(date, "LLL dd, y") : <span>{placeholder}</span>}
            </Button>
          }
        />
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar autoFocus defaultMonth={date} mode="single" selected={date} captionLayout="dropdown" onSelect={handleSelect} />
        </PopoverContent>
      </Popover>

      {date && (
        <button
          type="button"
          aria-label="Clear date"
          disabled={isPending}
          className="inset-e-2 absolute top-1/2 -translate-y-1/2 rounded-xs opacity-50 hover:opacity-100 disabled:pointer-events-none"
          onClick={handleClear}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export default DateFilter
