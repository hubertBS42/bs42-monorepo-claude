import type { DashboardPeriod } from "@/types"

export const PERIOD_LABELS: Record<DashboardPeriod, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" }

// For the chart's toggle, short enough to fit beside the title in a two-thirds column
export const SHORT_PERIOD_LABELS: Record<DashboardPeriod, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" }

// What each period is compared with
export const PREVIOUS_PERIODS: Record<DashboardPeriod, string> = { "7d": "the previous 7 days", "30d": "the previous 30 days", "90d": "the previous 90 days" }
