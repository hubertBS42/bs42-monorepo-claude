"use client"

import { useEffect, useSyncExternalStore } from "react"

// How many items the basket holds, for the header. Pages are cached and shared, so the header can't read the basket
// on the server: it asks /api/basket once, and the basket's actions report the new count after each change.

let count: number | null = null
const listeners = new Set<() => void>()

export function setBasketCount(next: number) {
  count = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Asks /api/basket again, e.g. after signing in or out, when the basket becomes the account's or a new one
export function refreshBasketCount() {
  return fetch("/api/basket", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { count: number } | null) => {
      if (data) setBasketCount(data.count)
    })
    .catch(() => {})
}

export function useBasketCount() {
  const value = useSyncExternalStore(
    subscribe,
    () => count,
    () => null
  )

  useEffect(() => {
    if (count !== null) return
    fetch("/api/basket", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { count: number } | null) => {
        if (data && count === null) setBasketCount(data.count)
      })
      .catch(() => {})
  }, [])

  return value
}

// For pages that load the basket themselves (the basket page), so the header agrees with them
export function SyncBasketCount({ count: next }: { count: number }) {
  useEffect(() => setBasketCount(next), [next])
  return null
}
