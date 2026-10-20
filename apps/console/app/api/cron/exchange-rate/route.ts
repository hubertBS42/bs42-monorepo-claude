import { fetchTodaysRate } from "@/lib/exchange-rate-fetch"
import { isCronAuthorized } from "@/lib/cron-auth"
import { notifyRateFetchFailed } from "@workspace/commerce/notifications"

// Saves today's USD→GHS rate from Open Exchange Rates, unless today already has one (an earlier run, or a rate a
// superAdmin set in Settings). Meant for a scheduler, once a day shortly after midnight (Africa/Accra, UTC+0):
// POST with "Authorization: Bearer $CRON_SECRET". A failure answers 502, so the scheduler can alert or retry, and
// emails the notification list (Settings → Notifications).

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const result = await fetchTodaysRate()
  if (result.status === "failed") {
    console.error(`Exchange rate fetch for ${result.date} failed:`, result.error)
    await notifyRateFetchFailed(result.date, result.error)
    return Response.json(result, { status: 502 })
  }
  return Response.json(result)
}
