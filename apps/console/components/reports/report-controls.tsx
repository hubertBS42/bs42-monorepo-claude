"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import {
  formatRange,
  matchPreset,
  MAX_DAILY_DAYS,
  presetRange,
  rangeDays,
  REPORT_PRESET_LABELS,
  REPORT_PRESETS,
  reportHref,
  type ReportGrouping,
  type ReportPreset,
  type ReportRange,
} from "@/lib/report-range"

const DAY_FORMAT = "yyyy-MM-dd"
// react-day-picker's range, which the console doesn't depend on directly
type DateRange = { from: Date | undefined; to?: Date }
// Plain days as the browser's dates, for the calendar only: the URL keeps the plain days
const toDate = (day: string) => parse(day, DAY_FORMAT, new Date())

const CUSTOM = "custom"
const presetOptions = [...REPORT_PRESETS.map((preset) => ({ value: preset, label: REPORT_PRESET_LABELS[preset] })), { value: CUSTOM, label: "Custom range" }]

interface ReportControlsProps {
  basePath: string
  range: ReportRange
  // The server's today, so the presets don't depend on the browser's clock
  today: string
}

// A report's range and grouping, kept in the URL
export default function ReportControls({ basePath, range, today }: ReportControlsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  // The first day clicked, until the second completes the range (one day: the same day twice)
  const [start, setStart] = useState<Date | undefined>()
  const preset = matchPreset(range, today) ?? CUSTOM

  const go = (from: string, to: string, by?: ReportGrouping) => {
    const days = rangeDays(from, to)
    // A new range picks its own grouping, unless one was chosen; day by day only goes so far
    const grouping = by ?? (days > 62 ? "month" : "day")
    startTransition(() => router.push(reportHref(basePath, { from, to, by: grouping === "day" && days > MAX_DAILY_DAYS ? "month" : grouping }), { scroll: false }))
  }

  const choosePreset = (value: string | null) => {
    if (!value || value === CUSTOM) {
      if (value === CUSTOM) setIsOpen(true)
      return
    }
    const bounds = presetRange(value as ReportPreset, today)
    go(bounds.from, bounds.to)
  }

  const clickDay = (day: Date) => {
    if (!start) return setStart(day)
    const [from, to] = day < start ? [day, start] : [start, day]
    setIsOpen(false)
    setStart(undefined)
    go(format(from, DAY_FORMAT), format(to, DAY_FORMAT))
  }
  const selected: DateRange = start ? { from: start, to: undefined } : { from: toDate(range.from), to: toDate(range.to) }

  const tooLongForDays = rangeDays(range.from, range.to) > MAX_DAILY_DAYS

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select items={presetOptions} value={preset} onValueChange={choosePreset} disabled={isPending}>
        <SelectTrigger className="w-40" aria-label="Range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) setStart(undefined)
        }}
      >
        <PopoverTrigger
          render={
            <Button variant="outline" disabled={isPending} className="font-normal">
              <CalendarIcon className="opacity-50" />
              {formatRange(range)}
            </Button>
          }
        />
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={toDate(range.from)}
            selected={selected}
            onDayClick={clickDay}
            // Without onSelect the calendar keeps its own selection and ignores `selected` after the first click
            onSelect={() => {}}
            captionLayout="dropdown"
            startMonth={new Date(2020, 0)}
            endMonth={toDate(today)}
            disabled={{ after: toDate(today) }}
          />
        </PopoverContent>
      </Popover>

      <ToggleGroup
        multiple={false}
        value={[range.by]}
        onValueChange={(value) => value[0] && value[0] !== range.by && go(range.from, range.to, value[0] as ReportGrouping)}
        variant="outline"
        spacing={0}
        disabled={isPending}
        aria-label="Group by"
      >
        <ToggleGroupItem value="day" disabled={tooLongForDays} className="px-3">
          By day
        </ToggleGroupItem>
        <ToggleGroupItem value="month" className="px-3">
          By month
        </ToggleGroupItem>
      </ToggleGroup>

      {isPending && <Spinner className="text-muted-foreground" />}
    </div>
  )
}
