import { admin, organization } from "better-auth/plugins"
import { consoleAdminRoles, hasSystemPermission, hasSystemRole, storeRoleForSystemAdmin, systemAccessController, systemRoles } from "./system-permissions"
import { organizationAccessController, organizationRoles } from "./organization-permissions"
import { InviteMemberEmail, sendEmail } from "@workspace/email"
import { authURLs } from "./constants"
import { prisma, readAppSettings, resolveConsoleName } from "@workspace/db"
import { nextCookies } from "better-auth/next-js"
import { APIError } from "better-auth/api"
import { PLATFORM_ORGANIZATION_SLUG, INVITATION_EXPIRATION_SECONDS } from "@workspace/contracts"
import { checkStoreInput } from "./store-input"

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
          logoUrl: settings.logoUrl,
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
          shippingPolicy: {
            type: "string",
            input: true,
            required: false,
          },
          returnsPolicy: {
            type: "string",
            input: true,
            required: false,
          },
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
