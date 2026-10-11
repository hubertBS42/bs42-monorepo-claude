import "server-only"

import { prisma } from "@workspace/db"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { SESSION_CACHE_EXPIRATION_SECONDS } from "@workspace/contracts"
import { authURLs } from "./constants"

const secret = process.env.BETTER_AUTH_SECRET

if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be set and at least 32 characters")
}

const trustedOrigins = [new URL(authURLs.store).origin, new URL(authURLs.console).origin]

const cookieDomain = process.env.AUTH_COOKIE_DOMAIN

if (process.env.NODE_ENV === "production" && !cookieDomain) {
  throw new Error("AUTH_COOKIE_DOMAIN must be set in production to share auth sessions between subdomains")
}

export const sharedAuthOptions = {
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret,
  trustedOrigins,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: SESSION_CACHE_EXPIRATION_SECONDS,
    },
  },
  advanced: {
    crossSubDomainCookies: cookieDomain ? { enabled: true, domain: cookieDomain } : { enabled: false },
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

export { authURLs }
