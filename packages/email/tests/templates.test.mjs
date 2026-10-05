import assert from "node:assert/strict"
import test from "node:test"
import { render } from "react-email"
import { InviteMemberEmail } from "../dist/src/templates/invite-member-email.js"
import { OrderConfirmation } from "../dist/src/templates/order/order-confirmation.js"
import { OrderConfirmed } from "../dist/src/templates/order/order-confirmed.js"
import { OrderCancelled } from "../dist/src/templates/order/order-cancelled.js"
import { OrderDelivered } from "../dist/src/templates/order/order-delivered.js"
import { OrderRefunded } from "../dist/src/templates/order/order-refunded.js"
import { OrderShipped } from "../dist/src/templates/order/order-shipped.js"
import { PasswordUpdatedEmail } from "../dist/src/templates/password-updated-email.js"
import { ResetPasswordEmail } from "../dist/src/templates/reset-password-email.js"
import { SetPasswordEmail } from "../dist/src/templates/set-password-email.js"

const orderDetails = {
  customerName: "Alex Morgan",
  reference: "ORDER-123",
}

const templates = [
  [
    "password reset",
    ResetPasswordEmail({
      name: "Alex Morgan",
      url: "https://example.com/reset",
    }),
    "https://example.com/reset",
  ],
  [
    "password setup",
    SetPasswordEmail({ name: "Alex Morgan", url: "https://example.com/setup" }),
    "https://example.com/setup",
  ],
  [
    "password update",
    PasswordUpdatedEmail({ name: "Alex Morgan" }),
    "Password updated",
  ],
  [
    "member invitation",
    InviteMemberEmail({
      name: "Alex Morgan",
      inviterName: "Taylor",
      storeName: "BS42",
      role: "member",
      url: "https://example.com/invite",
    }),
    "https://example.com/invite",
  ],
  [
    "order confirmation",
    OrderConfirmation({
      ...orderDetails,
      items: [],
      subtotalGhs: 10,
      shippingPrice: 0,
      taxPrice: 0,
      discountAmount: null,
      discountType: null,
      discountValue: null,
      discountReason: null,
      totalPrice: 10,
      shippingMethod: "PICKUP",
      paymentMethod: "Cash",
    }),
    "ORDER-123",
  ],
  ["order confirmed", OrderConfirmed({ ...orderDetails }), "ORDER-123"],
  [
    "order shipped",
    OrderShipped({
      ...orderDetails,
      shippingAddress: "123 Example Street",
    }),
    "123 Example Street",
  ],
  ["order delivered", OrderDelivered({ ...orderDetails }), "ORDER-123"],
  [
    "order cancelled",
    OrderCancelled({
      ...orderDetails,
      cancellationReason: "Customer request",
      totalPrice: 10,
    }),
    "Customer request",
  ],
  [
    "order refunded",
    OrderRefunded({
      ...orderDetails,
      refundReason: "Customer request",
      totalPrice: 10,
    }),
    "Customer request",
  ],
]

for (const [name, template, expectedContent] of templates) {
  test(`renders ${name} email`, async () => {
    const html = await render(template)
    assert.ok(html.includes(expectedContent))
  })
}
