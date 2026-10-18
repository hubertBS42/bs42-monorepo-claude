import assert from "node:assert/strict"
import test from "node:test"
import { render } from "react-email"
import { InviteMemberEmail } from "../dist/src/templates/invite-member-email.js"
import { OrderConfirmation } from "../dist/src/templates/order/order-confirmation.js"
import { OrderConfirmed } from "../dist/src/templates/order/order-confirmed.js"
import { OrderCancelled } from "../dist/src/templates/order/order-cancelled.js"
import { OrderDelivered } from "../dist/src/templates/order/order-delivered.js"
import { OrderPaymentReceived } from "../dist/src/templates/order/order-payment-received.js"
import { OrderRefunded } from "../dist/src/templates/order/order-refunded.js"
import { OrderShipped } from "../dist/src/templates/order/order-shipped.js"
import { PasswordUpdatedEmail } from "../dist/src/templates/password-updated-email.js"
import { ResetPasswordEmail } from "../dist/src/templates/reset-password-email.js"
import { SetPasswordEmail } from "../dist/src/templates/set-password-email.js"
import { StaffAlertEmail } from "../dist/src/templates/staff-alert-email.js"

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
  ["password setup", SetPasswordEmail({ name: "Alex Morgan", url: "https://example.com/setup" }), "https://example.com/setup"],
  ["password update", PasswordUpdatedEmail({ name: "Alex Morgan" }), "Password updated"],
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
      items: [{ productName: "Example Shirt", variantDescription: "Red / L", quantity: 2, totalPriceGhs: 10 }],
      subtotalGhs: 10,
      shippingGhs: 0,
      taxGhs: 0,
      discountAmountGhs: 0,
      discountType: null,
      discountValue: null,
      discountReason: null,
      totalGhs: 10,
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
    "staff alert",
    StaffAlertEmail({
      preview: "New order",
      heading: "New order",
      intro: "A customer placed an order.",
      details: [{ label: "Total", value: "GH₵41.33" }],
      action: { label: "View order", url: "https://example.com/orders/1" },
      appName: "BS42",
    }),
    "https://example.com/orders/1",
  ],
  ["order payment received", OrderPaymentReceived({ ...orderDetails, amountGhs: 41.33, paymentMethod: "Mobile money" }), "41.33"],
  [
    "order cancelled",
    OrderCancelled({
      ...orderDetails,
      cancellationReason: "Customer request",
      totalGhs: 10,
    }),
    "Customer request",
  ],
  [
    "order refunded",
    OrderRefunded({
      ...orderDetails,
      refundReason: "Customer request",
      refundAmountGhs: 10,
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

test("order summary shows each line's stored GHS amount and hides a zero discount", async () => {
  const html = await render(
    OrderConfirmation({
      ...orderDetails,
      // 1.333 USD × 3 would round differently per line than in total; the template must show the stored amounts as they are
      items: [
        { productName: "Line A", variantDescription: null, quantity: 1, totalPriceGhs: 20.67 },
        { productName: "Line B", variantDescription: null, quantity: 1, totalPriceGhs: 20.66 },
      ],
      subtotalGhs: 41.33,
      shippingGhs: 0,
      taxGhs: 0,
      discountAmountGhs: 0,
      discountType: null,
      discountValue: null,
      discountReason: null,
      totalGhs: 41.33,
      shippingMethod: "PICKUP",
      paymentMethod: "Cash",
    })
  )
  assert.ok(html.includes("20.67"))
  assert.ok(html.includes("20.66"))
  assert.ok(html.includes("41.33"))
  // `0 && …` would render a stray "0" where the discount row goes
  assert.ok(!html.includes("Discount"))
  assert.ok(!/>0</.test(html))
})
