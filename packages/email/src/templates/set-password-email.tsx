import {
  APP_LOGO,
  APP_NAME,
  RESET_PASSWORD_TOKEN_EXPIRATION,
} from "../constants.js"
import { formatDuration } from "../formatters.js"
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email"

interface SetPasswordEmailProps {
  name: string
  url: string
}

export function SetPasswordEmail({ name, url }: SetPasswordEmailProps) {
  const previewText = `You've been invited to ${APP_NAME}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="m-auto bg-[#f4f4f5] font-sans">
          <Container className="mx-auto my-10 max-w-120">
            {/* Header */}
            <Section className="rounded-t-xl bg-[#18181b] px-10 py-8 text-center">
              {APP_LOGO && (
                <Img
                  src={APP_LOGO}
                  width="90"
                  alt={APP_NAME}
                  className="mx-auto"
                />
              )}
            </Section>

            {/* Body */}
            <Section className="bg-white px-10 py-8">
              <Heading className="m-0 mb-2 text-xl font-semibold text-[#18181b]">
                Welcome to {APP_NAME}
              </Heading>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                Hi {name},
              </Text>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                An account has been created for you on {APP_NAME}. Click the
                button below to set your password and get started.
              </Text>

              <Section className="my-8 text-center">
                <Button
                  href={url}
                  className="rounded-lg bg-[#18181b] px-6 py-3 text-sm font-medium text-white no-underline"
                >
                  Set Password
                </Button>
              </Section>

              <Hr className="my-6 border-[#e4e4e7]" />

              <Text className="text-xs leading-relaxed text-[#71717a]">
                This link will expire in{" "}
                <strong>
                  {formatDuration(RESET_PASSWORD_TOKEN_EXPIRATION)}
                </strong>
                . If you weren&apos;t expecting this email, you can safely
                ignore it.
              </Text>

              <Text className="mt-0 text-xs text-[#71717a]">
                If the button above doesn&apos;t work, copy and paste this URL
                into your browser:
              </Text>
              <Text className="mt-0 text-xs break-all text-[#18181b]">
                {url}
              </Text>
            </Section>

            {/* Footer */}
            <Section className="rounded-b-xl border border-t-0 border-[#e4e4e7] bg-[#fafafa] px-10 py-6">
              <Text className="m-0 text-center text-xs text-[#a1a1aa]">
                © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
              </Text>
              <Text className="m-0 mt-1 text-center text-xs text-[#a1a1aa]">
                You&apos;re receiving this email because an account was created
                for you on {APP_NAME}.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
