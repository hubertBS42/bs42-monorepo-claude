"use server"

import { consoleBootstrapAuth } from "@workspace/auth/console-bootstrap"
import { PLATFORM_ORGANIZATION_SLUG } from "@/constants"
import { prisma } from "@workspace/db"
import { Pool, type PoolClient } from "pg"
import { setupFormSchema } from "../schemas/bootstrap.schemas"

export type SetupActionResult =
  | {
      status: "created" | "already-initialized" | "in-progress" | "failed"
    }
  | { status: "invalid" }

const lockKey = 0x42533432

declare global {
  // eslint-disable-next-line no-var
  var __setupLockPool: Pool | undefined
}

function getPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  // Stored on globalThis so dev hot reloads don't create a new pool each time
  globalThis.__setupLockPool ??= new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
  })
  return globalThis.__setupLockPool
}

export async function createInitialAdmin(input: unknown): Promise<SetupActionResult> {
  const parsed = setupFormSchema.safeParse(input)
  if (!parsed.success) return { status: "invalid" }

  const email = parsed.data.email.toLowerCase()

  let client: PoolClient | undefined
  let inTransaction = false
  let startedEmpty = false
  let organizationCreationAttempted = false

  try {
    client = await getPool().connect()

    // The transaction exists only to hold the advisory lock.
    // Ending it, however it ends, releases the lock.
    await client.query("BEGIN")
    inTransaction = true

    const { rows } = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_xact_lock($1, $2) AS locked", [lockKey, 1])
    if (!rows[0]?.locked) {
      return { status: "in-progress" }
    }

    if (
      (await prisma.user.count()) > 0 ||
      (await prisma.organization.findUnique({
        where: { slug: PLATFORM_ORGANIZATION_SLUG },
      }))
    ) {
      return { status: "already-initialized" }
    }

    // From here on, anything in the user table is ours to clean up
    startedEmpty = true

    const signUp = await consoleBootstrapAuth.api.signUpEmail({
      body: {
        name: parsed.data.fullName,
        email,
        password: parsed.data.password,
      },
    })

    const createdUser = await prisma.user.findUnique({
      where: { id: signUp.user.id },
    })
    if (!createdUser || createdUser.email.toLowerCase() !== email || (await prisma.user.count()) !== 1) {
      throw new Error("The initial administrator could not be verified")
    }

    await prisma.user.update({
      where: { id: createdUser.id },
      data: { role: "superAdmin" },
    })

    organizationCreationAttempted = true
    await consoleBootstrapAuth.api.createOrganization({
      body: {
        name: "Global",
        slug: PLATFORM_ORGANIZATION_SLUG,
        userId: createdUser.id,
      },
    })

    return { status: "created" }
  } catch (error) {
    console.error("Initial administrator setup failed:", error)

    // Cleanup runs while the lock is still held
    if (organizationCreationAttempted) {
      try {
        await prisma.organization.deleteMany({
          where: { slug: PLATFORM_ORGANIZATION_SLUG },
        })
      } catch (cleanupError) {
        console.error("Initial organization setup cleanup failed:", cleanupError)
      }
    }

    if (startedEmpty) {
      try {
        // By email, so a partial signup that never returned an id is still removed
        await prisma.user.deleteMany({ where: { email } })
      } catch (cleanupError) {
        console.error("Initial administrator setup cleanup failed:", cleanupError)
      }
    }

    return { status: "failed" }
  } finally {
    let releaseError: Error | undefined
    if (client && inTransaction) {
      try {
        await client.query("ROLLBACK")
      } catch (error) {
        console.error("Could not end initial setup lock transaction:", error)
        releaseError = error instanceof Error ? error : new Error(String(error))
      }
    }
    // Passing an error destroys the connection instead of returning it to the pool
    client?.release(releaseError)
  }
}
