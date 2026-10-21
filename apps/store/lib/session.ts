import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { storeAuth } from "@workspace/auth/store"

// The signed-in customer, or null. Once per request: the basket and the page may both ask.
export const getStoreSession = cache(async () => storeAuth.api.getSession({ headers: await headers() }))
