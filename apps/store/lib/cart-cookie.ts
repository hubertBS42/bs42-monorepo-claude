import "server-only"

import { cookies } from "next/headers"
import { CART_LIFETIME_DAYS } from "@workspace/contracts"

// The basket's id in the browser. httpOnly: only the server reads it. A basket lasts CART_LIFETIME_DAYS from the last
// add, as does its row (the console's unpaid-orders job clears out older ones).
export const CART_COOKIE = "bs42_cart"
const MAX_AGE_SECONDS = 60 * 60 * 24 * CART_LIFETIME_DAYS

export async function readCartId() {
  return (await cookies()).get(CART_COOKIE)?.value ?? null
}

// Only in server actions and route handlers, which can set cookies. The basket row itself is made on the first add.
export async function ensureCartId() {
  const store = await cookies()
  const id = store.get(CART_COOKIE)?.value ?? crypto.randomUUID()
  store.set(CART_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_SECONDS })
  return id
}
