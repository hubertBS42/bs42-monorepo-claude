import { parsePositiveIntegerEnv } from "@workspace/utils/env"
export const SITE_MAILER_HOST = process.env.SITE_MAILER_HOST
export const SITE_MAILER_EMAIL = process.env.SITE_MAILER_EMAIL
export const SITE_MAILER_PASSWORD = process.env.SITE_MAILER_PASSWORD
export const SITE_MAILER_PORT = parsePositiveIntegerEnv(process.env.SITE_MAILER_PORT, "SITE_MAILER_PORT", 465)
