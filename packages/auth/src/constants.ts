import { parsePositiveIntegerEnv } from "@workspace/utils/env"

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "BS42.NET"
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
export const PLATFORM_ORGANIZATION_SLUG =
  process.env.PLATFORM_ORGANIZATION_SLUG?.trim() || "global"
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
