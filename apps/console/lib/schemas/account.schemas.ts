import z from "zod"
import { PLATFORM_ALERTS } from "@workspace/contracts"
import { optionalHttpUrl } from "./common.schemas"

// The signed-in user's own account (/account/*)

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be no more than 100 characters"),
  // An empty field or null removes the avatar; the action also checks the URL is one of our own blobs
  image: optionalHttpUrl("Invalid image URL"),
})

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "You need to provide the current password."),
  newPassword: z.string().min(8, "Password must be at least 8 characters.").max(128, "Password must be no more than 128 characters."),
})

// The form also asks for the new password twice; the action doesn't need the confirmation
export const updatePasswordFormSchema = updatePasswordSchema
  .extend({ confirmPassword: z.string().min(1, "Confirm your new password.") })
  .superRefine(({ currentPassword, newPassword, confirmPassword }, ctx) => {
    if (newPassword !== confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords don't match." })
    }
    if (currentPassword !== "" && newPassword === currentPassword) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Choose a password different from your current one." })
    }
  })

export const sessionIdSchema = z.uuid("Invalid session ID")

// One switch on /account/notifications, for one of the user's stores
export const STORE_NOTIFICATION_PREFERENCES = ["notifyOrders", "notifyStock", "notifyRefunds"] as const

// A platform admin's own bell for one of the platform's alerts
export const platformAlertSchema = z.object({
  alert: z.enum(PLATFORM_ALERTS.map((item) => item.alert)),
  bell: z.boolean(),
})

export const storeNotificationSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
  preference: z.enum(STORE_NOTIFICATION_PREFERENCES),
  enabled: z.boolean(),
})
