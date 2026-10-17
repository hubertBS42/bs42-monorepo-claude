"use client"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { format, isValid, parse } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

// Like DateFilter, the URL holds plain days (yyyy-MM-dd), both included, not timestamps: a timestamp would be the
// browser's midnight, which isn't the app's. The loader decides what the days mean (e.g. createdAt within them).
const DAY_FORMAT = "yyyy-MM-dd"

const parseDay = (raw: string | undefined) => {
  const parsed = raw ? parse(raw, DAY_FORMAT, new Date()) : undefined
  return parsed && isValid(parsed) ? parsed : undefined
}

interface DateRangeFilterProps {
  id: string
  startKey: string
  endKey: string
  values: Record<string, string>
  setValues: (v: Record<string, string>) => void
  applyFilters: (overrides?: Record<string, string>) => void
  isPending?: boolean
}

const DateRangeFilter = ({
  id,
  startKey,
  endKey,
  values,
  setValues,
  applyFilters,
  isPending,
}: DateRangeFilterProps) => {
  const from = parseDay(values[startKey])
  const to = parseDay(values[endKey])
  const date: DateRange | undefined = from && to ? { from, to } : undefined

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      const newValues = {
        ...values,
        [startKey]: format(range.from, DAY_FORMAT),
        [endKey]: format(range.to ?? range.from, DAY_FORMAT),
      }
      setValues(newValues)

      if (range.to) applyFilters(newValues)
    } else {
      const newValues = { ...values, [startKey]: "", [endKey]: "" }
      setValues(newValues)
      applyFilters(newValues)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newValues = { ...values, [startKey]: "", [endKey]: "" }
    setValues(newValues)
    applyFilters(newValues)
  }

  return (
    <div className="relative">
      <Popover>
        <PopoverTrigger
          id={id}
          render={
            <Button
              variant="outline"
              disabled={isPending}
              className={cn(
                "h-8 w-full justify-start text-left font-light",
                !date && "text-muted-foreground",
                date && "pe-8"
              )}
            >
              <CalendarIcon className="mr-px size-4 opacity-50" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} -{" "}
                    {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          }
        />
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            autoFocus
            defaultMonth={date?.from}
            mode="range"
            selected={date}
            captionLayout="dropdown"
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>

      {date && (
        <button
          type="button"
          aria-label="Clear date range"
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

export default DateRangeFilter
