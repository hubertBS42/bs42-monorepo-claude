import "server-only"

import { timingSafeEqual } from "node:crypto"

// The cron routes are for a scheduler, which sends "Authorization: Bearer $CRON_SECRET". /api routes skip proxy.ts,
// so each route checks this itself. Without a CRON_SECRET nothing is authorized.
export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get("authorization") ?? "")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
