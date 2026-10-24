import "server-only"

import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS, RESET_PASSWORD_TOKEN_EXPIRATION_SECONDS } from "@workspace/contracts"
import { ExistingAccountEmail, PasswordUpdatedEmail, ResetPasswordEmail, sendEmail, VerifyEmailEmail } from "@workspace/email"
import { prisma, readAppSettings, resolveDarkLogoUrl, resolveStoreName } from "@workspace/db"
import { authURLs, sharedAuthOptions } from "./shared"

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
  throw new Error("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in")
}

// Without them the sign-in pages offer email only
export const isGoogleSignInEnabled = Boolean(googleClientId && googleClientSecret)

// Customer emails go out in the storefront's name. Not awaited: sign-up answers the same for an email that already
// has an account (which sends nothing), so waiting on the mailer would tell the two apart.
function sendCustomerEmail(build: (appName: string, logoUrl: string | null) => Parameters<typeof sendEmail>[0]) {
  void readAppSettings()
    .then((settings) => sendEmail(build(resolveStoreName(settings), resolveDarkLogoUrl(settings))))
    .catch((error) => console.error("Could not send a storefront account email:", error))
}

export const storeAuth = betterAuth({
  ...sharedAuthOptions,
  appName: "BS42 Store",
  baseURL: authURLs.store,
  advanced: {
    ...sharedAuthOptions.advanced,
    // The session cookie is shared with the console, but not the cookie that caches the session: each instance caches
    // its own schema's fields, and this one has no admin or organization plugin, so the console reading its cache would
    // see a user with no role and a session with no workspace.
    cookies: {
      session_data: { name: "bs42-store.session_data" },
      account_data: { name: "bs42-store.account_data" },
    },
  },
  emailAndPassword: {
    enabled: true,
    // An order made as a guest shows in the account whose email matches, so the email must be the customer's
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_EXPIRATION_SECONDS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      sendCustomerEmail((appName, logoUrl) => ({
        to: user.email,
        fromName: appName,
        subject: `Reset your ${appName} password`,
        reactTemplate: ResetPasswordEmail({ name: user.name, url, appName, logoUrl }),
      }))
    },
    // Sign-up answers the same for an email that has an account, so the account's owner is told by email instead
    onExistingUserSignUp: async ({ user }) => {
      sendCustomerEmail((appName, logoUrl) => ({
        to: user.email,
        fromName: appName,
        subject: `You already have a ${appName} account`,
        reactTemplate: ExistingAccountEmail({
          name: user.name,
          signInUrl: new URL("/sign-in", authURLs.store).toString(),
          resetPasswordUrl: new URL("/forgot-password", authURLs.store).toString(),
          appName,
          logoUrl,
        }),
      }))
    },
    onPasswordReset: async ({ user }) => {
      sendCustomerEmail((appName, logoUrl) => ({
        to: user.email,
        fromName: appName,
        subject: "Your password has been updated!",
        reactTemplate: PasswordUpdatedEmail({ name: user.name, appName, logoUrl }),
      }))
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Signing in before verifying sends a fresh link (the first may have expired)
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS,
    sendVerificationEmail: async ({ user, url }) => {
      sendCustomerEmail((appName, logoUrl) => ({
        to: user.email,
        fromName: appName,
        subject: `Confirm your email for ${appName}`,
        reactTemplate: VerifyEmailEmail({ name: user.name, url, appName, logoUrl }),
      }))
    },
  },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},
  databaseHooks: {
    session: {
      create: {
        // The console's admin plugin refuses banned users, and this instance has no such plugin. Sessions are shared
        // with the console, so a banned staff member signing in here would otherwise be signed in there too.
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { banned: true, banExpires: true } })
          if (user?.banned && (!user.banExpires || user.banExpires > new Date())) {
            throw new APIError("FORBIDDEN", { message: "This account has been suspended.", code: "BANNED_USER" })
          }
        },
      },
    },
  },
  // Lets server actions sign in and out, setting the cookies
  plugins: [nextCookies()],
})

export type StoreSession = typeof storeAuth.$Infer.Session
