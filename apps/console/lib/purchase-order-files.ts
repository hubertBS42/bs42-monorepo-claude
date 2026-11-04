import "server-only"

import z from "zod"
import { consoleAuth } from "@workspace/auth/console"
import { consoleSessionLapse } from "@/lib/console-session"

// Purchase order files (invoices, receipts, delivery notes) live in the private storage container and are served only
// through the console's routes (app/api/purchase-orders/[id]/files), to members of the order's store. /api skips
// proxy.ts, so the routes check the session themselves.

const MAX_NAME_LENGTH = 200

// The name a file was uploaded with, kept for showing and downloading: no path, no control characters
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ""
  // eslint-disable-next-line no-control-regex -- removing control characters is the point
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim()
  return cleaned.slice(0, MAX_NAME_LENGTH) || "File"
}

export const isUuid = (value: string | null | undefined): value is string => !!value && z.uuid().safeParse(value).success

// The signed-in console session, or null for none (or one that has lapsed)
export async function getFileSession(request: Request) {
  const session = await consoleAuth.api.getSession({ headers: request.headers })
  if (!session || consoleSessionLapse(session.session)) return null
  return session
}

// Content-Disposition for a stored name: an ASCII fallback, and the real name encoded for browsers that read it
export function contentDisposition(name: string, download: boolean): string {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
}
