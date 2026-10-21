import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { storeAuth } from "@workspace/auth/store"

import { signInHref } from "@/lib/auth-redirect"

// The signed-in customer, or null. Once per request: the basket and the page may both ask.
export const getStoreSession = cache(async () => storeAuth.api.getSession({ headers: await headers() }))

// The account pages' guard: the signed-in customer, or off to sign in and back to `from`
export async function requireCustomer(from: string) {
  const session = await getStoreSession()
  if (!session) redirect(signInHref("/sign-in", from))
  return session
}
