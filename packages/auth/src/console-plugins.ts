import { admin, organization } from "better-auth/plugins"
import { consoleAdminRoles, hasSystemPermission, hasSystemRole, storeRoleForSystemAdmin, systemAccessController, systemRoles } from "./system-permissions"
import { organizationAccessController, organizationRoles } from "./organization-permissions"
import { InviteMemberEmail, sendEmail } from "@workspace/email"
import { authURLs } from "./constants"
import { prisma, readAppSettings, resolveDarkLogoUrl, resolveConsoleName } from "@workspace/db"
import { nextCookies } from "better-auth/next-js"
import { APIError } from "better-auth/api"
import { PLATFORM_ORGANIZATION_SLUG, INVITATION_EXPIRATION_SECONDS } from "@workspace/contracts"
import { checkStoreInput } from "./store-input"

async function assertNotPlatformStaff(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (hasSystemRole(user?.role, consoleAdminRoles)) {
    throw new APIError("FORBIDDEN", {
      message: "Platform staff belong to every store. Manage their access from Users instead.",
      code: "PLATFORM_STAFF",
    })
  }
}

export const consolePlugins = [
  admin({
    ac: systemAccessController,
    roles: systemRoles,
    defaultRole: "user",
    adminRoles: [...consoleAdminRoles],
  }),
  organization({
    ac: organizationAccessController,
    roles: organizationRoles,
    invitationExpiresIn: INVITATION_EXPIRATION_SECONDS,
    allowUserToCreateOrganization: (user) => hasSystemPermission(user.role, { organization: ["create"] }),
    async sendInvitationEmail(data) {
      const settings = await readAppSettings()
      const appName = resolveConsoleName(settings)
      const inviteLink = new URL(`/accept-invitation/${encodeURIComponent(data.id)}`, authURLs.console).toString()

      await sendEmail({
        to: data.email,
        fromName: appName,
        subject: `You've been invited to join ${data.organization.name} on ${appName}`,
        reactTemplate: InviteMemberEmail({
          inviterName: data.inviter.user.name,
          name: data.email,
          storeName: data.organization.name,
          role: data.role,
          url: inviteLink,
          appName,
          logoUrl: resolveDarkLogoUrl(settings),
        }),
      })
    },
    organizationHooks: {
      beforeCreateOrganization: async ({ organization }) => ({ data: checkStoreInput(organization) }),
      // Store admins (including invited staff) may call this endpoint directly, not just through the console form
      beforeUpdateOrganization: async ({ organization, user }) => {
        // Suspending or reactivating a store is for system admins, so store staff can't lift their own suspension
        if (organization.status !== undefined && !hasSystemPermission(user.role, { organization: ["update"] })) {
          throw new APIError("FORBIDDEN", { message: "Only platform admins can change a store's status." })
        }
        return { data: checkStoreInput(organization) }
      },
      beforeDeleteOrganization: async ({ organization }) => {
        if (organization.slug === PLATFORM_ORGANIZATION_SLUG) {
          throw new APIError("FORBIDDEN", {
            message: "The platform organization cannot be deleted",
          })
        }
        // Order lines restrict the delete anyway, but with a database error the console can't explain
        if (await prisma.orderItem.findFirst({ where: { organizationId: organization.id }, select: { id: true } })) {
          throw new APIError("BAD_REQUEST", {
            message: "This store has orders, so it can't be deleted. Suspend it instead.",
            code: "HAS_ORDERS",
          })
        }
        // Purchase order lines restrict deleting its listings in the same way
        if (await prisma.purchaseOrder.findFirst({ where: { organizationId: organization.id }, select: { id: true } })) {
          throw new APIError("BAD_REQUEST", {
            message: "This store has purchase orders, so it can't be deleted. Suspend it instead.",
            code: "HAS_ORDERS",
          })
        }
        // So do stock transfers, which restrict deleting both stores
        if (await prisma.stockTransfer.findFirst({ where: { OR: [{ fromStoreId: organization.id }, { toStoreId: organization.id }] }, select: { id: true } })) {
          throw new APIError("BAD_REQUEST", {
            message: "This store has sent or received stock transfers, so it can't be deleted. Suspend it instead.",
            code: "HAS_ORDERS",
          })
        }
      },
      // System admins belong to every store with a role that follows their system role. The console's own
      // flows keep that up through Prisma (store creation above, promote/demote), so these endpoints, which
      // store owners and admins can call directly, never remove or change a system admin's membership.
      beforeRemoveMember: async ({ member }) => {
        await assertNotPlatformStaff(member.userId)
      },
      beforeUpdateMemberRole: async ({ member }) => {
        await assertNotPlatformStaff(member.userId)
      },
      afterCreateOrganization: async ({ organization, user }) => {
        // Fix the creator's role — better-auth assigns owner by default
        // but admin users should only get admin org role
        const creator = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        })

        if (hasSystemRole(creator?.role, consoleAdminRoles) && storeRoleForSystemAdmin(creator?.role) === "admin") {
          // Downgrade creator from owner to admin
          await prisma.member.updateMany({
            where: {
              userId: user.id,
              organizationId: organization.id,
            },
            data: { role: "admin" },
          })
        }

        // Fetch all other system admins
        const systemAdmins = await prisma.user.findMany({
          where: {
            OR: [{ role: { contains: "admin" } }, { role: { contains: "Admin" } }],
            id: { not: user.id },
          },
          select: { id: true, role: true },
        })

        // Add all other system admins as members of the new org
        await prisma.member.createMany({
          data: systemAdmins
            .filter((systemAdmin) => hasSystemRole(systemAdmin.role, consoleAdminRoles))
            .map((systemAdmin) => ({
              userId: systemAdmin.id,
              organizationId: organization.id,
              role: storeRoleForSystemAdmin(systemAdmin.role),
            })),
          skipDuplicates: true,
        })
      },
    },
    schema: {
      organization: {
        additionalFields: {
          status: {
            type: "string",
            input: true,
            required: true,
          },
        },
      },
    },
  }),
  nextCookies(),
] as const
