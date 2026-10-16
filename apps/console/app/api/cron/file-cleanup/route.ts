import { timingSafeEqual } from "node:crypto"
import { sweepOrphanedFiles } from "@workspace/db"

// Deletes uploaded files that no record references (e.g. images picked on a form that was left without saving).
// Meant for a scheduler, once a day: POST with "Authorization: Bearer $CRON_SECRET". Add ?dryRun=1 to list the
// files without deleting them. /api routes skip proxy.ts, so this route checks the secret itself.

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get("authorization") ?? "")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1"

  try {
    const result = await sweepOrphanedFiles({ dryRun })
    return Response.json({
      dryRun,
      scanned: result.scanned,
      orphaned: result.orphaned.length,
      deleted: result.deleted,
      // A dry run lists the files so they can be checked before the real run
      ...(dryRun && { files: result.orphaned }),
    })
  } catch (error) {
    console.error("File cleanup failed:", error)
    return Response.json({ error: "File cleanup failed" }, { status: 500 })
  }
}
