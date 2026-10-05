import "server-only"

import { betterAuth } from "better-auth"
import { authURLs, sharedAuthOptions } from "./shared"
import { consolePlugins } from "./console-plugins"
import { APP_NAME, RESET_PASSWORD_TOKEN_EXPIRATION } from "./constants"
import {
  ResetPasswordEmail,
  sendEmail,
  PasswordUpdatedEmail,
  SetPasswordEmail,
} from "@workspace/email"

export const consoleAuth = betterAuth({
  ...sharedAuthOptions,
  appName: "BS42 Console",
  baseURL: authURLs.console,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_EXPIRATION,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
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
          subject: `You've been invited to ${APP_NAME} — set your password`,
          reactTemplate: SetPasswordEmail({
            name: user.name,
            url,
          }),
        })
      } else {
        await sendEmail({
          to: user.email,
          subject: `Reset your ${APP_NAME} password`,
          reactTemplate: ResetPasswordEmail({ name: user.name, url }),
        })
      }
    },
    onPasswordReset: async ({ user }) => {
      await sendEmail({
        to: user.email,
        subject: "Your password has been updated!",
        reactTemplate: PasswordUpdatedEmail({ name: user.name }),
      })
    },
  },
  plugins: [...consolePlugins],
})

export type Session = typeof consoleAuth.$Infer.Session

export default consoleAuth
