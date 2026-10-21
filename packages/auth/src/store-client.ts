"use client"

import { inferAdditionalFields } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import type { storeAuth } from "./store"

export const storeAuthClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof storeAuth>()],
})
