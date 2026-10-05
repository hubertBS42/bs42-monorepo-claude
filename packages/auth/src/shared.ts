import "server-only"

import { prisma } from "@workspace/db"
import { parsePositiveIntegerEnv } from "@workspace/utils/env"
import { prismaAdapter } from "better-auth/adapters/prisma"

const sessionCacheExpiration = parsePositiveIntegerEnv(
  process.env.SESSION_CACHE_EXPIRATION,
  "SESSION_CACHE_EXPIRATION",
  300
)

const secret = process.env.BETTER_AUTH_SECRET

if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be set and at least 32 characters")
}

const storeBaseURL =
  process.env.STORE_AUTH_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://bs42.net"
    : "http://localhost:3001")

const consoleBaseURL =
  process.env.CONSOLE_AUTH_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://console.bs42.net"
    : "http://localhost:3000")

const trustedOrigins = [
  new URL(storeBaseURL).origin,
  new URL(consoleBaseURL).origin,
]

const cookieDomain = process.env.AUTH_COOKIE_DOMAIN

if (process.env.NODE_ENV === "production" && !cookieDomain) {
  throw new Error(
    "AUTH_COOKIE_DOMAIN must be set in production to share auth sessions between subdomains"
  )
}

export const sharedAuthOptions = {
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret,
  trustedOrigins,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: sessionCacheExpiration,
    },
  },
  advanced: {
    crossSubDomainCookies: cookieDomain
      ? { enabled: true, domain: cookieDomain }
      : { enabled: false },
    database: {
      generateId: false as const,
    },
  },
  user: {
    additionalFields: {
      phone: {
        type: "string" as const,
        required: false as const,
        input: true,
      },
      dob: {
        type: "date" as const,
        required: false as const,
        input: true,
      },
      getMarketingEmails: {
        type: "boolean" as const,
        required: false as const,
        input: true,
      },
      getOrderEmails: {
        type: "boolean" as const,
        required: false as const,
        input: true,
      },
      getSecurityEmails: {
        type: "boolean" as const,
        required: false as const,
        input: true,
      },
    },
  },
}

export const authURLs = {
  store: storeBaseURL,
  console: consoleBaseURL,
}
