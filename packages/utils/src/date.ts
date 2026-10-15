import { tz } from "@date-fns/tz"
import { format } from "date-fns"

// Dates in client components are rendered twice: on the server during SSR, then in the browser while hydrating.
// Formatting in each machine's own time zone gives different text when the two differ, which React reports as a
// hydration mismatch. Formatting in one fixed zone gives the same text on both.
// Africa/Accra is the platform's home zone (UTC+0, no daylight saving).
export const APP_TIME_ZONE = "Africa/Accra"

export function formatDate(date: Date | string | number, pattern: string): string {
  return format(date, pattern, { in: tz(APP_TIME_ZONE) })
}
