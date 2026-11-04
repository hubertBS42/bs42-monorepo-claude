import { dayStart, formatDate } from "@workspace/utils/date"
import { getDayParam, getEnumParam, type SearchParamValue } from "@workspace/utils/search-params"

// The date range a report covers: plain days (yyyy-MM-dd) in the app's zone, both included, from the URL's ?from=,
// ?to= and ?by=. A plain module, so the report pages and their client controls share it.

export const REPORT_GROUPINGS = ["day", "month"] as const
export type ReportGrouping = (typeof REPORT_GROUPINGS)[number]

export interface ReportRange {
  from: string
  to: string
  by: ReportGrouping
}

// Day by day stops at a year: past that a report has too many rows to read
export const MAX_DAILY_DAYS = 366

export const REPORT_PRESETS = ["this-month", "last-month", "last-3-months", "this-year", "last-year", "last-12-months"] as const
export type ReportPreset = (typeof REPORT_PRESETS)[number]

export const REPORT_PRESET_LABELS: Record<ReportPreset, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "last-3-months": "Last 3 months",
  "this-year": "This year",
  "last-year": "Last year",
  "last-12-months": "Last 12 months",
}

export const todayKey = (now = new Date()) => formatDate(now, "yyyy-MM-dd")

// A month's first and last days. Months are 1-12; one outside that rolls into the next or previous year.
function monthBounds(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const last = new Date(Date.UTC(year, month, 0))
  return { first: first.toISOString().slice(0, 10), last: last.toISOString().slice(0, 10) }
}

export function presetRange(preset: ReportPreset, today: string): { from: string; to: string } {
  const [year, month] = today.split("-").map(Number) as [number, number]
  switch (preset) {
    case "this-month":
      return { from: monthBounds(year, month).first, to: today }
    case "last-month": {
      const { first, last } = monthBounds(year, month - 1)
      return { from: first, to: last }
    }
    case "last-3-months":
      return { from: monthBounds(year, month - 2).first, to: today }
    case "this-year":
      return { from: `${year}-01-01`, to: today }
    case "last-year":
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }
    case "last-12-months":
      return { from: monthBounds(year, month - 11).first, to: today }
  }
}

// The preset a range is, if any, for the controls' select
export function matchPreset(range: { from: string; to: string }, today: string): ReportPreset | null {
  return (
    REPORT_PRESETS.find((preset) => {
      const bounds = presetRange(preset, today)
      return bounds.from === range.from && bounds.to === range.to
    }) ?? null
  )
}

export const rangeDays = (from: string, to: string) => Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / 86_400_000) + 1

// Day by day for a range up to two months, else by month, unless the URL says otherwise
export function readReportRange(params: { from?: SearchParamValue; to?: SearchParamValue; by?: SearchParamValue }, now = new Date()): ReportRange {
  const today = todayKey(now)
  let from = getDayParam(params.from)
  let to = getDayParam(params.to)
  if (!from || !to) ({ from, to } = presetRange("this-month", today))
  if (from > to) [from, to] = [to, from]
  const days = rangeDays(from, to)
  const by = getEnumParam(params.by, REPORT_GROUPINGS) ?? (days > 62 ? "month" : "day")
  return { from, to, by: by === "day" && days > MAX_DAILY_DAYS ? "month" : by }
}

export function reportHref(basePath: string, range: ReportRange) {
  return `${basePath}?${new URLSearchParams({ from: range.from, to: range.to, by: range.by })}`
}

// The key a moment falls under: its day or its month, in the app's zone
export const periodKey = (date: Date, by: ReportGrouping) => formatDate(date, by === "day" ? "yyyy-MM-dd" : "yyyy-MM")

// Every day or month in the range, oldest first, so a report shows the quiet ones too
export function reportPeriods(range: ReportRange): { key: string; label: string }[] {
  if (range.by === "day") {
    return Array.from({ length: rangeDays(range.from, range.to) }, (_, index) => {
      const day = dayStart(range.from, index)
      return { key: periodKey(day, "day"), label: formatDate(day, "EEE, MMM d, yyyy") }
    })
  }
  const periods: { key: string; label: string }[] = []
  const [toYear, toMonth] = range.to.split("-").map(Number) as [number, number]
  for (let [year, month] = range.from.split("-").map(Number) as [number, number]; year < toYear || (year === toYear && month <= toMonth); month === 12 ? ((month = 1), year++) : month++) {
    const first = monthBounds(year, month).first
    periods.push({ key: first.slice(0, 7), label: formatDate(dayStart(first), "MMMM yyyy") })
  }
  return periods
}

export const formatRange = (range: { from: string; to: string }) =>
  range.from === range.to ? formatDate(dayStart(range.from), "MMM d, yyyy") : `${formatDate(dayStart(range.from), "MMM d, yyyy")} to ${formatDate(dayStart(range.to), "MMM d, yyyy")}`
