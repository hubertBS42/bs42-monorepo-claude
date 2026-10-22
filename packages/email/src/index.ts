export { sendEmail } from "./mailer.js"
export { EmailConfigurationError, EmailDeliveryError } from "./mailer.js"
export { formatCurrencyGhs, formatDuration } from "./formatters.js"
export { ResetPasswordEmail } from "./templates/reset-password-email.js"
export { SetPasswordEmail } from "./templates/set-password-email.js"
export { PasswordUpdatedEmail } from "./templates/password-updated-email.js"
export { VerifyEmailEmail } from "./templates/verify-email-email.js"
export { OrderLinkEmail } from "./templates/order-link-email.js"
export { ExistingAccountEmail } from "./templates/existing-account-email.js"
export { InviteMemberEmail } from "./templates/invite-member-email.js"
export { StaffAlertEmail } from "./templates/staff-alert-email.js"
export {
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  sendOrderCancelledEmail,
  sendOrderUnpaidCancelledEmail,
  sendOrderConfirmedEmail,
  sendOrderPaymentReceivedEmail,
  sendOrderRefundedEmail,
  sendOrderReturnedEmail,
  sendOrderReviewRequestEmail,
  sendOrderInstallationBookedEmail,
} from "./order-notifications.js"
export type { BaseOrderEmail, OrderConfirmationEmail } from "./order-notifications.js"
export type { ReturnedItem } from "./templates/order/order-returned.js"
export type { ReviewRequestItem } from "./templates/order/order-review-request.js"
