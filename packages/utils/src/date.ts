import { TZDate, tz } from "@date-fns/tz"
import { format } from "date-fns"

// Dates in client components are rendered twice: on the server during SSR, then in the browser while hydrating.
// Formatting in each machine's own time zone gives different text when the two differ, which React reports as a
// hydration mismatch. Formatting in one fixed zone gives the same text on both.
// Africa/Accra is the platform's home zone (UTC+0, no daylight saving).
export const APP_TIME_ZONE = "Africa/Accra"

export function formatDate(date: Date | string | number, pattern: string): string {
  return format(date, pattern, { in: tz(APP_TIME_ZONE) })
}

// The moment a plain yyyy-MM-dd day (as getDayParam returns it) begins in the app's zone, for date filters.
// For a whole day, filter from dayStart(day) up to, but not including, dayStart of the next day.
export function dayStart(day: string, addDays = 0): Date {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number]
  return new TZDate(year, month - 1, date + addDays, APP_TIME_ZONE)
}
