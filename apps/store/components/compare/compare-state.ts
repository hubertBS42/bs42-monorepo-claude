"use client"

import { useSyncExternalStore } from "react"

import { MAX_COMPARE } from "@/lib/compare"

// The products picked to compare: one category's, at most MAX_COMPARE, kept in this browser only (a comparison is
// short-lived, and guests compare too). Every checkbox and the comparison bar share it, and other tabs follow it through
// the storage event. The /compare page itself works from its URL.

export interface ComparePick {
  id: string
  name: string
  slug: string
  image: string | null
  categoryId: string
}

const STORAGE_KEY = "bs42-compare"
const NONE: ComparePick[] = []

let picks: ComparePick[] | null = null
const listeners = new Set<() => void>()

// Storage can be missing or blocked (private windows), so every read and write may fail: then the list lasts the page
function read(): ComparePick[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")
    return Array.isArray(parsed) ? (parsed as ComparePick[]).filter((pick) => typeof pick?.id === "string").slice(0, MAX_COMPARE) : NONE
  } catch {
    return NONE
  }
}

function setPicks(next: ComparePick[]) {
  picks = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Kept in memory only
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    picks = read()
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

const getPicks = () => (picks ??= read())

export function useComparePicks() {
  return useSyncExternalStore(subscribe, getPicks, () => NONE)
}

export type AddResult = "added" | "full" | "other-category"

export function addComparePick(pick: ComparePick): AddResult {
  const current = getPicks()
  if (current.some((existing) => existing.id === pick.id)) return "added"
  if (current.length && current[0]!.categoryId !== pick.categoryId) return "other-category"
  if (current.length >= MAX_COMPARE) return "full"
  setPicks([...current, pick])
  return "added"
}

export function removeComparePick(id: string) {
  setPicks(getPicks().filter((pick) => pick.id !== id))
}

// A new comparison: only this product
export function restartCompare(pick: ComparePick) {
  setPicks([pick])
}

export function clearCompare() {
  setPicks(NONE)
}

export const compareHref = (ids: string[]) => `/compare?ids=${ids.join(",")}`
