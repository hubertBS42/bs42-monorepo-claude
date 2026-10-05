# `@workspace/email`

Server-side email delivery and React Email templates for the storefront and
console.

## Configuration

Set these variables in the runtime that sends email:

| Variable                          | Required | Default        | Description                                                         |
| --------------------------------- | -------- | -------------- | ------------------------------------------------------------------- |
| `SITE_MAILER_HOST`                | Yes      | —              | SMTP server hostname                                                |
| `SITE_MAILER_EMAIL`               | Yes      | —              | SMTP username and sender address                                    |
| `SITE_MAILER_PASSWORD`            | Yes      | —              | SMTP password                                                       |
| `SITE_MAILER_PORT`                | No       | `465`          | SMTP port; port 465 uses implicit TLS, other ports require STARTTLS |
| `EMAIL_APP_NAME`                  | No       | `BS42.NET`     | Sender display name and template branding                           |
| `EMAIL_APP_LOGO`                  | No       | —              | Public HTTPS logo URL used in templates                             |
| `INVITATION_EXPIRATION`           | No       | `1800` seconds | Invitation link expiration shown in the email                       |
| `RESET_PASSWORD_TOKEN_EXPIRATION` | No       | `1800` seconds | Password link expiration shown in the email                         |

For compatibility, branding falls back to `NEXT_PUBLIC_APP_NAME` and
`NEXT_PUBLIC_APP_LOGO`. The previously misspelled
`INVITATION_EXPIRATION` and `RESET_PASSWORD_TOKEN_EXPIRATION` variables are also
accepted as fallbacks; prefer the corrected names. Expiration values must be
positive integer seconds.

The root Turbo configuration passes these variables through to workspace
tasks. Keep SMTP credentials in deployment secrets, never in source-controlled
environment files.

## Usage

Call the package only from server-side code:

```ts
import { sendOrderShippedEmail } from "@workspace/email"

await sendOrderShippedEmail({
  to: customer.email,
  customerName: customer.name,
  reference: order.reference,
  shippingAddress: order.shippingAddress,
})
```

The notification helpers return the SMTP message ID on success and throw on
configuration, rendering, or delivery errors. Catch delivery errors at the
calling workflow boundary and report or retry them there; do not treat a failed
send as successful.

`sendEmail` accepts a React Email element and renders both HTML and plain-text
alternatives. SMTP configuration is checked when the first message is sent, not
when the package is imported.

## Development

```sh
pnpm --filter @workspace/email build
pnpm --filter @workspace/email typecheck
pnpm --filter @workspace/email test
```
