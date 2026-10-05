import { parsePositiveIntegerEnv } from "@workspace/utils/env"
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "BS42.NET"
export const APP_LOGO = process.env.NEXT_PUBLIC_APP_LOGO?.trim() || undefined
export const INVITATION_EXPIRATION = parsePositiveIntegerEnv(
  process.env.INVITATION_EXPIRATION,
  "INVITATION_EXPIRATION",
  1800
)
export const RESET_PASSWORD_TOKEN_EXPIRATION = parsePositiveIntegerEnv(
  process.env.RESET_PASSWORD_TOKEN_EXPIRATION,
  "RESET_PASSWORD_TOKEN_EXPIRATION",
  1800
)
export const SITE_MAILER_HOST = process.env.SITE_MAILER_HOST
export const SITE_MAILER_EMAIL = process.env.SITE_MAILER_EMAIL
export const SITE_MAILER_PASSWORD = process.env.SITE_MAILER_PASSWORD
export const SITE_MAILER_PORT = parsePositiveIntegerEnv(
  process.env.SITE_MAILER_PORT,
  "SITE_MAILER_PORT",
  465
)
