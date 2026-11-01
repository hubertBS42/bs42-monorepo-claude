import "server-only"

import { prisma } from "@workspace/db"

// Staff are signed out of the console after 12 hours without loading a page or running an action, and 7 days after
// signing in, whatever Better Auth's own expiry says: sessions are shared with the storefront, where customers stay
// signed in as long as they come back within a week. proxy.ts enforces both.
export const CONSOLE_IDLE_LIMIT_MS = 12 * 60 * 60 * 1000
export const CONSOLE_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// The session row's updatedAt is its last console activity: proxy.ts moves it on at most once a minute, and Better Auth
// only writes it when it saves the session (extending it about once a day, or switching workspace). The bell's polling
// doesn't go through proxy.ts, so it doesn't count.
const ACTIVITY_INTERVAL_MS = 60 * 1000

export type ConsoleSessionLapse = "idle" | "expired"

type SessionTimes = { id: string; createdAt: Date | string; updatedAt: Date | string }

// Why the console should sign this session out, or null while it's within both limits. The session may come from
// Better Auth's cookie cache, up to a minute old, which doesn't matter against hours.
export function consoleSessionLapse(session: SessionTimes, now = Date.now()): ConsoleSessionLapse | null {
  if (now - new Date(session.createdAt).getTime() >= CONSOLE_SESSION_MAX_AGE_MS) return "expired"
  if (now - new Date(session.updatedAt).getTime() >= CONSOLE_IDLE_LIMIT_MS) return "idle"
  return null
}

// Sessions this server moved on in the last minute, so a cached session's older updatedAt doesn't send a write per page
const recentlyRecorded = new Map<string, number>()

// Records a page load or action as the session's latest activity
export async function recordConsoleActivity(session: SessionTimes, now = Date.now()) {
  const since = now - ACTIVITY_INTERVAL_MS
  if (new Date(session.updatedAt).getTime() > since || (recentlyRecorded.get(session.id) ?? 0) > since) return
  if (recentlyRecorded.size > 10_000) recentlyRecorded.clear()
  recentlyRecorded.set(session.id, now)
  // Another server may have moved it on already
  await prisma.session.updateMany({ where: { id: session.id, updatedAt: { lt: new Date(since) } }, data: { updatedAt: new Date(now) } })
}
