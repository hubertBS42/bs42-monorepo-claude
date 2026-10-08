import "server-only"

import { betterAuth } from "better-auth"
import { authURLs, sharedAuthOptions } from "./shared"
import { consolePlugins } from "./console-plugins"
import { RESET_PASSWORD_TOKEN_EXPIRATION_SECONDS } from "@workspace/contracts"
import { ResetPasswordEmail, sendEmail, PasswordUpdatedEmail, SetPasswordEmail } from "@workspace/email"
import { readAppSettings, resolveConsoleName } from "@workspace/db"

export const consoleAuth = betterAuth({
  ...sharedAuthOptions,
  appName: "BS42 Console",
  baseURL: authURLs.console,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_EXPIRATION_SECONDS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const settings = await readAppSettings()
      const appName = resolveConsoleName(settings)
      const resetUrl = new URL(url)
      const callbackURL = resetUrl.searchParams.get("callbackURL")

      let action = "reset"

      if (callbackURL) {
        try {
          const callbackUrl = new URL(callbackURL, resetUrl.origin)
          action = callbackUrl.searchParams.get("action") || "reset"
        } catch (error) {
          console.error("Failed to parse callbackURL:", error)
        }
      }

      if (action === "set") {
        await sendEmail({
          to: user.email,
          fromName: appName,
          subject: `You've been invited to ${appName} — set your password`,
          reactTemplate: SetPasswordEmail({
            name: user.name,
            url,
            appName,
            logoUrl: settings.logoUrl,
          }),
        })
      } else {
        await sendEmail({
          to: user.email,
          fromName: appName,
          subject: `Reset your ${appName} password`,
          reactTemplate: ResetPasswordEmail({ name: user.name, url, appName, logoUrl: settings.logoUrl }),
        })
      }
    },
    onPasswordReset: async ({ user }) => {
      const settings = await readAppSettings()
      const appName = resolveConsoleName(settings)
      await sendEmail({
        to: user.email,
        fromName: appName,
        subject: "Your password has been updated!",
        reactTemplate: PasswordUpdatedEmail({ name: user.name, appName, logoUrl: settings.logoUrl }),
      })
    },
  },
  plugins: [...consolePlugins],
})

export type Session = typeof consoleAuth.$Infer.Session

export default consoleAuth
