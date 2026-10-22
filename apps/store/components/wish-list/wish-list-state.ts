"use client"

import { useEffect, useSyncExternalStore } from "react"

import { saveToWishListAction } from "@/lib/actions/wish-list.actions"

// Which items the signed-in customer has saved, for every heart on the page and the header's count. Pages are cached
// and shared, so it's asked of /api/wish-list once, and kept up to date by the hearts.

export type WishListState = { signedIn: false } | { signedIn: true; keys: ReadonlySet<string> }

export interface WishListItemKey {
  productId: string
  variantId: string | null
}

export const wishListKey = ({ productId, variantId }: WishListItemKey) => `${productId}:${variantId ?? ""}`

// A signed-out visitor's heart sends them to sign in, back to the page with ?save=<productId>[.<variantId>], and the
// item is saved once they're back
export const SAVE_PARAM = "save"

let state: WishListState | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function setState(next: WishListState) {
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Asks /api/wish-list again, e.g. after signing out
export function refreshWishList() {
  loading = fetch("/api/wish-list", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { items: WishListItemKey[] | null } | null) => {
      if (data) setState(data.items ? { signedIn: true, keys: new Set(data.items.map(wishListKey)) } : { signedIn: false })
    })
    .catch(() => {})
  return loading
}

export function loadWishList() {
  return loading ?? refreshWishList()
}

// The state now, for an event handler that waited for it (its render's copy may be from before it loaded)
export const getWishListState = () => state

export function setSaved(key: string, saved: boolean) {
  if (!state?.signedIn) return
  const keys = new Set(state.keys)
  if (saved) keys.add(key)
  else keys.delete(key)
  setState({ signedIn: true, keys })
}

export function useWishList() {
  const value = useSyncExternalStore(
    subscribe,
    () => state,
    () => null
  )

  useEffect(() => {
    void loadWishList()
  }, [])

  return value
}

// The item a heart saves on returning from sign-in
export function saveParamValue(item: WishListItemKey) {
  return item.variantId ? `${item.productId}.${item.variantId}` : item.productId
}

// Saves the item named by ?save= once the customer is back from signing in, then takes the parameter off the URL.
// Returns the saved item's key, or null when there was nothing to save; throws the action's error message.
export async function saveFromUrl(): Promise<string | null> {
  const url = new URL(window.location.href)
  const value = url.searchParams.get(SAVE_PARAM)
  if (!value) return null

  url.searchParams.delete(SAVE_PARAM)
  window.history.replaceState(null, "", url)

  await loadWishList()
  if (!state?.signedIn) return null
  const [productId = "", variantId = null] = value.split(".")
  const item = { productId, variantId }
  const result = await saveToWishListAction(item)
  if (!result.success) throw new Error(result.error)
  setSaved(wishListKey(item), true)
  return wishListKey(item)
}
