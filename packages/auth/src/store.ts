import "server-only"

import { betterAuth } from "better-auth"
import { authURLs, sharedAuthOptions } from "./shared"

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
  throw new Error(
    "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in"
  )
}

if (
  process.env.NODE_ENV === "production" &&
  (!googleClientId || !googleClientSecret)
) {
  throw new Error(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for storefront auth in production"
  )
}

export const storeAuth = betterAuth({
  ...sharedAuthOptions,
  appName: "BS42 Store",
  baseURL: authURLs.store,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},
})
