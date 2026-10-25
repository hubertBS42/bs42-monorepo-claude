import { RESET_PASSWORD_TOKEN_EXPIRATION_SECONDS } from "@workspace/contracts"
import { formatDuration } from "../formatters.js"
import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Tailwind, Text } from "react-email"
import { DARK_FILL } from "./dark-fill.js"

interface ResetPasswordEmailProps {
  name: string
  url: string
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const ResetPasswordEmail = ({ name, url, appName, logoUrl }: ResetPasswordEmailProps) => {
  const previewText = `Reset your ${appName} password`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="m-auto bg-[#f4f4f5] font-sans">
          <Container className="mx-auto my-10 max-w-120">
            {/* Header */}
            <Section className="rounded-t-xl bg-[#18181b] px-10 py-8 text-center" style={DARK_FILL}>
              {logoUrl ? <Img src={logoUrl} width="90" alt={appName} className="mx-auto" /> : <Text className="m-0 text-lg font-semibold text-white">{appName}</Text>}
            </Section>

            {/* Body */}
            <Section className="bg-white px-10 py-8">
              <Heading className="m-0 mb-2 text-xl font-semibold text-[#18181b]">Reset your password</Heading>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {name},</Text>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                We received a request to reset the password for your {appName} account. Click the button below to choose a new password.
              </Text>

              <Section className="my-8 text-center">
                <Button href={url} className="rounded-lg bg-[#18181b] px-6 py-3 text-sm font-medium text-white no-underline">
                  Reset Password
                </Button>
              </Section>

              <Hr className="my-6 border-[#e4e4e7]" />

              <Text className="text-xs leading-relaxed text-[#71717a]">
                If you didn&apos;t request a password reset, you can safely ignore this email — your password will remain unchanged. This link will expire in{" "}
                <strong>{formatDuration(RESET_PASSWORD_TOKEN_EXPIRATION_SECONDS)}</strong>.
              </Text>

              <Text className="mt-0 text-xs text-[#71717a]">If the button above doesn&apos;t work, copy and paste this URL into your browser:</Text>
              <Text className="mt-0 text-xs break-all text-[#18181b]">{url}</Text>
            </Section>

            {/* Footer */}
            <Section className="rounded-b-xl border border-t-0 border-[#e4e4e7] bg-[#fafafa] px-10 py-6">
              <Text className="m-0 text-center text-xs text-[#a1a1aa]">
                © {new Date().getFullYear()} {appName}. All rights reserved.
              </Text>
              <Text className="m-0 mt-1 text-center text-xs text-[#a1a1aa]">You&apos;re receiving this email because a password reset was requested for your account.</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
