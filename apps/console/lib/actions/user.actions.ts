"use server"
import { randomBytes } from "node:crypto"
import { headers } from "next/headers"
import { consoleAuth } from "@workspace/auth/console"
import { canManageUserWithRole, hasSystemPermission, hasSystemRole, storeRoleForSystemAdmin } from "@workspace/auth/system-permissions"
import { formatError } from "@workspace/auth/format-error"
import { prisma } from "@workspace/db"
import { addStoreMemberAction, removeStoreMemberAction, updateStoreMemberRoleAction } from "./member.actions"
import { ActionResponse } from "@workspace/contracts"
import type { SystemPermission } from "@/lib/auth-guard"
import { addAddressActionSchema, banUserFormSchema, createUserActionSchema, updateAddressActionSchema, updateUserActionSchema } from "@/lib/schemas/user.schemas"
import z from "zod"

// Every export here is a public endpoint, so every input is validated

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const userIdSchema = z.uuid("Invalid user ID")

type ConsoleSession = NonNullable<Awaited<ReturnType<typeof consoleAuth.api.getSession>>>

// Resolves the caller's session and checks a system permission. Returns an error message instead of redirecting.
async function getSessionWithPermission(permissions: SystemPermission): Promise<{ session: ConsoleSession; headersObj: Headers } | { error: string }> {
  const headersObj = await headers()
  const session = await consoleAuth.api.getSession({ headers: headersObj })
  if (!session) return { error: "Unauthorized" }
  if (!hasSystemPermission(session.user.role, permissions)) return { error: "Forbidden" }
  return { session, headersObj }
}

// Only superAdmins can manage superAdmins. The consoleAuth hook enforces the same rule on Better Auth's admin endpoints.
async function getTargetUserError(session: ConsoleSession, userId: string): Promise<string | null> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!target) return "User not found"
  if (!canManageUserWithRole(session.user.role, target.role)) return "Only super admins can manage super admins"
  return null
}

// Throws on failure; callers report it
async function addUserToAllStores({ userId, systemRole }: { userId: string; systemRole: string }) {
  const stores = await prisma.organization.findMany({
    select: { id: true },
  })

  await prisma.member.createMany({
    data: stores.map((store) => ({
      userId,
      organizationId: store.id,
      role: storeRoleForSystemAdmin(systemRole),
    })),
    skipDuplicates: true,
  })
}

export async function createUserAction(input: z.input<typeof createUserActionSchema>): Promise<ActionResponse> {
  try {
    const parsed = createUserActionSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { name, email, image, phone, dob, getMarketingEmails, getOrderEmails, getSecurityEmails, systemRole, stores } = parsed.data

    const auth = await getSessionWithPermission({ user: ["create"] })
    if ("error" in auth) return { success: false, error: auth.error }
    const { headersObj } = auth

    // Checked after the permission check so it can't be used to probe which emails are registered.
    // Better Auth stores emails lowercased and would reject the duplicate too, but only with a message string.
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } })
    if (existing) return { success: false, error: "This email address is already registered to a user", code: "EMAIL_EXISTS" }

    // The user sets their own password from the email below, so this one is never shared
    const password = randomBytes(32).toString("base64url")

    // Created without a role (so "user"): passing one needs the set-role permission, which admins don't have
    const newUser = await consoleAuth.api.createUser({
      body: { name, email, password, data: { image, phone, dob, getMarketingEmails, getOrderEmails, getSecurityEmails } },
      headers: headersObj,
    })
    const userId = newUser.user.id

    // From here on the user exists, so failures are reported as "User created, but ..." rather than as a failed create
    const problems: string[] = []

    if (systemRole !== "user") {
      try {
        await prisma.user.update({ where: { id: userId }, data: { role: systemRole } })
        await addUserToAllStores({ userId, systemRole })
      } catch (error) {
        problems.push(`setting up the ${systemRole} role failed (${formatError(error)})`)
      }
    } else if (stores?.length) {
      const results = await Promise.all(stores.map(({ storeId, storeRole }) => addStoreMemberAction({ userId, storeId, role: storeRole })))
      const failed = results.filter((result) => !result.success)
      if (failed.length) problems.push(`${failed.length} of ${stores.length} store assignment(s) failed (${failed.map((result) => result.error).join("; ")})`)
    }

    try {
      await consoleAuth.api.requestPasswordReset({
        body: { email, redirectTo: "/set-password?action=set" },
        headers: headersObj,
      })
    } catch (error) {
      problems.push(`the set-password email wasn't sent (${formatError(error)})`)
    }

    if (problems.length) return { success: false, error: `User created, but ${problems.join(", and ")}.` }
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Returns one message per failed change; empty when everything succeeded
async function updateOrgMemberships({
  userId,
  stores,
  removedMembers,
}: {
  userId: string
  stores: NonNullable<z.infer<typeof updateUserActionSchema>["stores"]>
  removedMembers: NonNullable<z.infer<typeof updateUserActionSchema>["removedMembers"]>
}): Promise<string[]> {
  // Removals run first, so a store that is removed and re-added in one request can't collide with itself
  const removals = await Promise.all(removedMembers.map(({ memberId, storeId }) => removeStoreMemberAction({ memberId, storeId })))

  const results = await Promise.all([
    // Add new memberships
    ...stores.filter((store) => store.isNew).map(({ storeRole, storeId }) => addStoreMemberAction({ userId, storeId, role: storeRole })),

    // Update memberships whose role changed
    ...stores
      .filter((store) => !store.isNew && store.memberId)
      .map(async ({ memberId, storeRole, storeId }): Promise<ActionResponse> => {
        const existingMembership = await prisma.member.findFirst({
          where: { id: memberId, userId },
          select: { role: true },
        })
        if (!existingMembership) return { success: false, error: "Membership not found" }
        if (existingMembership.role === storeRole) return { success: true }
        return updateStoreMemberRoleAction({ memberId: memberId!, role: storeRole, storeId })
      }),
  ])

  return [...removals, ...results].flatMap((result) => (result.success ? [] : [result.error]))
}

export async function updateUserAction(input: z.input<typeof updateUserActionSchema>): Promise<ActionResponse> {
  try {
    const parsed = updateUserActionSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { id, name, email, image, phone, dob, getMarketingEmails, getSecurityEmails, getOrderEmails, stores, removedMembers } = parsed.data

    const auth = await getSessionWithPermission({ user: email ? ["update", "set-email"] : ["update"] })
    if ("error" in auth) return { success: false, error: auth.error }
    const { session, headersObj } = auth

    const targetError = await getTargetUserError(session, id)
    if (targetError) return { success: false, error: targetError }

    await consoleAuth.api.adminUpdateUser({
      body: {
        userId: id,
        // Cleared fields arrive as "". They must be null, not undefined: Better Auth skips undefined, so the old value would stay.
        data: { name, ...(email && { email }), image: image || null, phone: phone || null, dob, getMarketingEmails, getSecurityEmails, getOrderEmails },
      },
      headers: headersObj,
    })

    // The profile is saved at this point, so membership failures are reported as "User updated, but ..."
    if (stores?.length || removedMembers?.length) {
      const failures = await updateOrgMemberships({
        userId: id,
        stores: stores ?? [],
        removedMembers: removedMembers ?? [],
      })
      if (failures.length) return { success: false, error: `User updated, but ${failures.length} store change(s) failed: ${failures.join("; ")}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function banUserAction(input: z.input<typeof banUserFormSchema>): Promise<ActionResponse> {
  try {
    const parsed = banUserFormSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const data = parsed.data

    const auth = await getSessionWithPermission({ user: ["ban"] })
    if ("error" in auth) return { success: false, error: auth.error }
    const { session, headersObj } = auth

    const targetError = await getTargetUserError(session, data.userId)
    if (targetError) return { success: false, error: targetError }

    let banExpiresIn: number | undefined = undefined

    if (data.banExpiresIn) {
      const now = Date.now() // current time in ms
      banExpiresIn = Math.floor((data.banExpiresIn.getTime() - now) / 1000)
    }

    await consoleAuth.api.banUser({
      body: {
        userId: data.userId,
        banExpiresIn,
        banReason: data.banReason?.trim() || undefined,
      },
      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function unbanUserAction(userId: string): Promise<ActionResponse> {
  try {
    const parsed = userIdSchema.safeParse(userId)
    if (!parsed.success) return invalidInput(parsed.error)

    const auth = await getSessionWithPermission({ user: ["ban"] })
    if ("error" in auth) return { success: false, error: auth.error }
    const { session, headersObj } = auth

    const targetError = await getTargetUserError(session, userId)
    if (targetError) return { success: false, error: targetError }

    await consoleAuth.api.unbanUser({
      body: {
        userId,
      },
      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function deleteUserAction(userId: string): Promise<ActionResponse> {
  try {
    const parsed = userIdSchema.safeParse(userId)
    if (!parsed.success) return invalidInput(parsed.error)

    const auth = await getSessionWithPermission({ user: ["delete"] })
    if ("error" in auth) return { success: false, error: auth.error }
    const { session, headersObj } = auth

    const targetError = await getTargetUserError(session, userId)
    if (targetError) return { success: false, error: targetError }

    // Memberships are cascade deleted by better-auth
    await consoleAuth.api.removeUser({
      body: { userId },
      headers: headersObj,
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Moves a system admin between admin and superAdmin. The role and the store memberships change in one transaction
// so the invariant holds: superAdmins are owners of every store, admins are admins of every store.
// Prisma is used instead of Better Auth's setRole so both writes commit or neither does.
async function changeSystemAdminRole(userId: string, change: "promote" | "demote"): Promise<ActionResponse> {
  const parsed = userIdSchema.safeParse(userId)
  if (!parsed.success) return invalidInput(parsed.error)

  const auth = await getSessionWithPermission({ user: ["set-role"] })
  if ("error" in auth) return { success: false, error: auth.error }
  const { session } = auth

  if (session.user.id === userId) return { success: false, error: "You can't change your own role" }

  const newRole = change === "promote" ? "superAdmin" : "admin"

  // Serializable so two superAdmins demoting each other at the same time can't both succeed
  return prisma.$transaction(
    async (tx): Promise<ActionResponse> => {
      const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, banned: true } })
      if (!target) return { success: false, error: "User not found" }

      if (change === "promote") {
        // Store staff become admins first, so promotion is always a deliberate second step
        if (hasSystemRole(target.role, ["superAdmin"])) return { success: false, error: "User is already a super admin" }
        if (!hasSystemRole(target.role, ["admin"])) return { success: false, error: "Only admins can be promoted to super admin" }
        if (target.banned) return { success: false, error: "Banned users can't be promoted" }
      } else {
        if (!hasSystemRole(target.role, ["superAdmin"])) return { success: false, error: "User isn't a super admin" }
        const otherSuperAdmins = await tx.user.count({ where: { id: { not: userId }, role: { contains: "superAdmin" } } })
        if (otherSuperAdmins === 0) return { success: false, error: "The last super admin can't be demoted" }
      }

      await tx.user.update({ where: { id: userId }, data: { role: newRole } })

      const storeRole = storeRoleForSystemAdmin(newRole)
      await tx.member.updateMany({ where: { userId }, data: { role: storeRole } })

      // Covers stores the user was somehow missing from
      const stores = await tx.organization.findMany({ select: { id: true } })
      await tx.member.createMany({
        data: stores.map((store) => ({ userId, organizationId: store.id, role: storeRole })),
        skipDuplicates: true,
      })

      return { success: true }
    },
    { isolationLevel: "Serializable" }
  )
}

// SuperAdmin-only (set-role). The target's cached session keeps its old role for up to SESSION_CACHE_EXPIRATION_SECONDS.
export async function promoteToSuperAdminAction(userId: string): Promise<ActionResponse> {
  try {
    return await changeSystemAdminRole(userId, "promote")
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function demoteToAdminAction(userId: string): Promise<ActionResponse> {
  try {
    return await changeSystemAdminRole(userId, "demote")
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Admin-only: emails a user a link to set or reset their password. Users resetting their own password call
// Better Auth from the browser instead (reset-password-form), which keeps its rate limiting and origin checks.
// "set" sends the welcome-style email for users who haven't chosen a password yet (as createUserAction does).
export async function sendPasswordResetEmailAction(userId: string, kind: "set" | "reset" = "reset"): Promise<ActionResponse> {
  try {
    const parsed = z.object({ userId: userIdSchema, kind: z.enum(["set", "reset"]) }).safeParse({ userId, kind })
    if (!parsed.success) return invalidInput(parsed.error)

    const auth = await getSessionWithPermission({ user: ["update"] })
    if ("error" in auth) return { success: false, error: auth.error }
    const { session, headersObj } = auth

    const targetError = await getTargetUserError(session, parsed.data.userId)
    if (targetError) return { success: false, error: targetError }

    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { email: true } })
    if (!user) return { success: false, error: "User not found" }

    await consoleAuth.api.requestPasswordReset({
      body: { email: user.email, redirectTo: parsed.data.kind === "set" ? "/set-password?action=set" : "/set-password" },
      headers: headersObj,
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Users can manage their own addresses. Managing anyone else's needs the user:update system permission.
async function getAddressAccessError(userId: string): Promise<string | null> {
  const session = await consoleAuth.api.getSession({ headers: await headers() })
  if (!session) return "Unauthorized"
  if (session.user.id !== userId && !hasSystemPermission(session.user.role, { user: ["update"] })) return "Forbidden"
  return null
}

export async function addAddressAction(input: z.input<typeof addAddressActionSchema>): Promise<ActionResponse> {
  try {
    const parsed = addAddressActionSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { userId, data } = parsed.data

    const accessError = await getAddressAccessError(userId)
    if (accessError) return { success: false, error: accessError }

    await prisma.$transaction(async (tx) => {
      const totalAddresses = await tx.address.count({
        where: {
          userId,
        },
      })

      const makeDefault = totalAddresses === 0 || data.isDefault

      // If setting new address as default, unset all others
      if (makeDefault && totalAddresses > 0) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        })
      }

      await tx.address.create({
        data: {
          name: data.name,
          phone: data.phone,
          user: { connect: { id: userId } },
          line1: data.line1,
          line2: data.line2,
          region: data.region,
          town: data.town,
          isDefault: makeDefault,
          latitude: data.latitude,
          longitude: data.longitude,
        },
      })
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function updateAddressAction(input: z.input<typeof updateAddressActionSchema>): Promise<ActionResponse> {
  try {
    const parsed = updateAddressActionSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { userId, data } = parsed.data

    const accessError = await getAddressAccessError(userId)
    if (accessError) return { success: false, error: accessError }

    const addressId = data.id

    // The address must belong to the user the caller was authorized for
    const existingAddress = await prisma.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    })
    if (!existingAddress) return { success: false, error: "Address not found" }

    await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        // Unset any other default addresses for this user
        await tx.address.updateMany({
          where: {
            userId,
            isDefault: true,
            id: { not: addressId },
          },
          data: {
            isDefault: false,
          },
        })
      }

      // Update this address
      await tx.address.update({
        where: {
          id: addressId,
        },
        data: {
          name: data.name,
          phone: data.phone,
          line1: data.line1,
          line2: data.line2,
          region: data.region,
          town: data.town,
          isDefault: data.isDefault,
          latitude: data.latitude,
          longitude: data.longitude,
        },
      })
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function deleteAddressAction(id: string): Promise<ActionResponse> {
  try {
    if (!z.uuid().safeParse(id).success) return { success: false, error: "Missing or invalid address ID." }

    // Get the addres being deleted
    const addressToDelete = await prisma.address.findUnique({
      where: { id },
      select: { isDefault: true, userId: true },
    })

    if (!addressToDelete) throw new Error("Address does not exist.")

    const accessError = await getAddressAccessError(addressToDelete.userId)
    if (accessError) return { success: false, error: accessError }

    await prisma.$transaction(async (tx) => {
      // Delete the address
      await tx.address.delete({
        where: {
          id,
        },
      })

      // If it was the default, assign a new one
      if (addressToDelete.isDefault) {
        const latestAddress = await tx.address.findFirst({
          where: { userId: addressToDelete.userId },
          orderBy: { createdAt: "desc" },
        })

        if (latestAddress) {
          await tx.address.update({
            where: { id: latestAddress.id },
            data: { isDefault: true },
          })
        }
      }
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
