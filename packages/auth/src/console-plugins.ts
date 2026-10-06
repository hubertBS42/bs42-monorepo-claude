import { admin, organization } from "better-auth/plugins"
import {
  consoleAdminRoles,
  hasSystemRole,
  systemAccessController,
  systemRoles,
} from "./system-permissions"
import {
  organizationAccessController,
  organizationRoles,
} from "./organization-permissions"
import { InviteMemberEmail, sendEmail } from "@workspace/email"
import {
  APP_NAME,
  APP_URL,
  INVITATION_EXPIRATION,
  PLATFORM_ORGANIZATION_SLUG,
} from "./constants"
import { prisma } from "@workspace/db"
import { nextCookies } from "better-auth/next-js"
import { APIError } from "better-auth/api"

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
    invitationExpiresIn: INVITATION_EXPIRATION,
    allowUserToCreateOrganization: (user) =>
      hasSystemRole(user.role, ["superAdmin"]),
    async sendInvitationEmail(data) {
      const inviteLink = `${APP_URL}/accept-invitation/${data.id}`

      await sendEmail({
        to: data.email,
        subject: `You've been invited to join ${data.organization.name} on ${APP_NAME}`,
        reactTemplate: InviteMemberEmail({
          inviterName: data.inviter.user.name,
          name: data.email,
          storeName: data.organization.name,
          role: data.role,
          url: inviteLink,
        }),
      })
    },
    organizationHooks: {
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

        if (
          hasSystemRole(creator?.role, ["admin"]) &&
          !hasSystemRole(creator?.role, ["superAdmin"])
        ) {
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
            OR: [
              { role: { contains: "admin" } },
              { role: { contains: "Admin" } },
            ],
            id: { not: user.id },
          },
          select: { id: true, role: true },
        })

        // Add all other system admins as members of the new org
        await prisma.member.createMany({
          data: systemAdmins
            .filter((systemAdmin) =>
              hasSystemRole(systemAdmin.role, ["admin", "superAdmin"])
            )
            .map((systemAdmin) => ({
              userId: systemAdmin.id,
              organizationId: organization.id,
              role: hasSystemRole(systemAdmin.role, ["superAdmin"])
                ? "owner"
                : "admin",
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
