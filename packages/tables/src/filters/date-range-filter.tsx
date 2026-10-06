"use client"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { format } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

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
  const date: DateRange | undefined =
    values[startKey] && values[endKey]
      ? { from: new Date(values[startKey]), to: new Date(values[endKey]) }
      : undefined

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      const from = new Date(range.from)
      from.setHours(0, 0, 0, 0)

      const to = new Date(range.to ?? range.from)
      to.setHours(23, 59, 59, 999)

      const newValues = {
        ...values,
        [startKey]: from.toISOString(),
        [endKey]: to.toISOString(),
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
