"use client"

import { useEffect, useSyncExternalStore } from "react"

// The signed-in customer's trade discount (a percentage), for shelf prices and the quantity pickers. Pages are cached
// and shared, so it's asked of /api/trade once per page load. Null until it's known, and without an approved account.

let percent: number | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Asks /api/trade again, e.g. after signing in or out
export function refreshTrade() {
  loading = fetch("/api/trade", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { percent: string | null } | null) => {
      if (!data) return
      percent = data.percent === null ? null : Number(data.percent)
      for (const listener of listeners) listener()
    })
    .catch(() => {})
  return loading
}

export function useTradePercent() {
  const value = useSyncExternalStore(
    subscribe,
    () => percent,
    () => null
  )

  useEffect(() => {
    if (!loading) void refreshTrade()
  }, [])

  return value
}
