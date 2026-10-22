import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { storeAuth } from "@workspace/auth/store"
import { loadTradeTerms } from "@workspace/commerce/trade-accounts"
import { prisma } from "@workspace/db"

import { signInHref } from "@/lib/auth-redirect"

// The signed-in customer, or null. Once per request: the basket and the page may both ask.
export const getStoreSession = cache(async () => storeAuth.api.getSession({ headers: await headers() }))

// The signed-in customer's trade terms (an approved trade account's discount), or null. Once per request.
export const getTradeTerms = cache(async () => loadTradeTerms(prisma, (await getStoreSession())?.user.id ?? null))

// The account pages' guard: the signed-in customer, or off to sign in and back to `from`
export async function requireCustomer(from: string) {
  const session = await getStoreSession()
  if (!session) redirect(signInHref("/sign-in", from))
  return session
}
