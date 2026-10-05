import { APP_NAME, APP_LOGO } from "../constants.js"
import {
  Body,
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

interface PasswordUpdatedEmailProps {
  name: string
}

export const PasswordUpdatedEmail = ({ name }: PasswordUpdatedEmailProps) => {
  const previewText = `Your ${APP_NAME} password has been updated`

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
                Password updated
              </Heading>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                Hi {name},
              </Text>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                Your {APP_NAME} account password was successfully updated.
              </Text>

              <Hr className="my-6 border-[#e4e4e7]" />

              <Text className="text-xs leading-relaxed text-[#71717a]">
                If you didn&apos;t make this change, please reset your password
                immediately or contact our support team — your account may have
                been compromised.
              </Text>
            </Section>

            {/* Footer */}
            <Section className="rounded-b-xl border border-t-0 border-[#e4e4e7] bg-[#fafafa] px-10 py-6">
              <Text className="m-0 text-center text-xs text-[#a1a1aa]">
                © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
              </Text>
              <Text className="m-0 mt-1 text-center text-xs text-[#a1a1aa]">
                You&apos;re receiving this email because your account password
                was recently changed.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
