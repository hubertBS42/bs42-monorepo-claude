import "server-only"

import { cookies } from "next/headers"
import { CART_LIFETIME_DAYS } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"

import { claimCart } from "./cart"
import { getStoreSession } from "./session"

// The basket's id in the browser. httpOnly: only the server reads it. A basket lasts CART_LIFETIME_DAYS from the last
// add, as does its row (the console's unpaid-orders job clears out older ones). A signed-in customer's basket is their
// account's whatever the cookie says (claimCart).
export const CART_COOKIE = "bs42_cart"
const MAX_AGE_SECONDS = 60 * 60 * 24 * CART_LIFETIME_DAYS

async function resolveCartId(create: boolean) {
  const [session, cookieCartId] = await Promise.all([getStoreSession(), cookies().then((store) => store.get(CART_COOKIE)?.value ?? null)])
  const userId = session?.user.id ?? null
  // Signed out, it only reads
  if (!userId) return claimCart(prisma, null, cookieCartId, create)

  const claim = () => prisma.$transaction((tx) => claimCart(tx, userId, cookieCartId, create), { maxWait: 10000, timeout: 20000 })
  try {
    return await claim()
  } catch (error) {
    // Two requests right after signing in (the page and the header's count) can both merge the guest basket, or both
    // create the account's. The second fails on the deleted basket or the unique key, rolls back, and finds the
    // first one's result when it tries again.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2002")) return claim()
    throw error
  }
}

export async function readCartId() {
  return resolveCartId(false)
}

// Only in server actions and route handlers, which can set cookies. A guest's basket row is made on the first add; a
// signed-in customer's here, so the add finds it with their account on it.
export async function ensureCartId() {
  const id = (await resolveCartId(true))!
  const store = await cookies()
  store.set(CART_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_SECONDS })
  return id
}
