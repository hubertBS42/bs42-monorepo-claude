import "server-only"

import nodemailer, { type Transporter } from "nodemailer"
import { render } from "react-email"
import type { ReactElement } from "react"
import {
  APP_NAME,
  SITE_MAILER_EMAIL,
  SITE_MAILER_HOST,
  SITE_MAILER_PASSWORD,
  SITE_MAILER_PORT,
} from "./constants.js"

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EmailConfigurationError"
  }
}

export class EmailDeliveryError extends Error {
  constructor(message: string, options: ErrorOptions) {
    super(message, options)
    this.name = "EmailDeliveryError"
  }
}

let transporter: Transporter | undefined

function getTransporter() {
  const host = SITE_MAILER_HOST?.trim()
  const from = SITE_MAILER_EMAIL?.trim()
  const password = SITE_MAILER_PASSWORD

  if (!host || !from || !password) {
    throw new EmailConfigurationError(
      "SITE_MAILER_HOST, SITE_MAILER_EMAIL, and SITE_MAILER_PASSWORD must be configured before sending email"
    )
  }

  if (!Number.isInteger(SITE_MAILER_PORT) || SITE_MAILER_PORT > 65535) {
    throw new EmailConfigurationError(
      "SITE_MAILER_PORT must be an integer between 1 and 65535"
    )
  }

  transporter ??= nodemailer.createTransport({
    host,
    port: SITE_MAILER_PORT,
    secure: SITE_MAILER_PORT === 465,
    requireTLS: SITE_MAILER_PORT !== 465,
    auth: {
      user: from,
      pass: password,
    },
  })

  return { transporter, from }
}

export async function sendEmail({
  to,
  subject,
  reactTemplate,
}: {
  to: string
  subject: string
  reactTemplate: ReactElement
}): Promise<{ messageId: string }> {
  const recipient = to.trim()
  const emailSubject = subject.trim()

  if (!recipient) {
    throw new TypeError("Email recipient must not be empty")
  }
  if (!emailSubject || /[\r\n]/.test(emailSubject)) {
    throw new TypeError("Email subject must be non-empty and single-line")
  }

  const { transporter: mailer, from } = getTransporter()

  try {
    const [html, text] = await Promise.all([
      render(reactTemplate),
      render(reactTemplate, { plainText: true }),
    ])

    const info = await mailer.sendMail({
      from: { name: APP_NAME, address: from },
      to: recipient,
      subject: emailSubject,
      html,
      text,
    })

    return { messageId: info.messageId }
  } catch (cause) {
    throw new EmailDeliveryError("Failed to render or send email", {
      cause,
    })
  }
}
