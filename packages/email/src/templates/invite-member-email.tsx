import { APP_NAME, APP_LOGO, INVITATION_EXPIRATION } from "../constants.js"
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

interface InviteMemberEmailProps {
  name: string
  inviterName: string
  storeName: string
  role: string
  url: string
}

export const InviteMemberEmail = ({
  name,
  inviterName,
  storeName,
  role,
  url,
}: InviteMemberEmailProps) => {
  const previewText = `${inviterName} invited you to join ${storeName} on ${APP_NAME}`

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
                You&apos;ve been invited
              </Heading>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                Hi {name},
              </Text>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                <strong className="text-[#18181b]">{inviterName}</strong> has
                invited you to join{" "}
                <strong className="text-[#18181b]">{storeName}</strong> on{" "}
                {APP_NAME} as a{" "}
                <strong className="text-[#18181b]">{role}</strong>.
              </Text>

              <Section className="my-8 text-center">
                <Button
                  href={url}
                  className="rounded-lg bg-[#18181b] px-6 py-3 text-sm font-medium text-white no-underline"
                >
                  Accept Invitation
                </Button>
              </Section>

              <Hr className="my-6 border-[#e4e4e7]" />

              <Text className="text-xs leading-relaxed text-[#71717a]">
                This invitation will expire in{" "}
                <strong>{formatDuration(INVITATION_EXPIRATION)}</strong>. If you
                weren&apos;t expecting this invitation, you can safely ignore
                this email.
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
                You&apos;re receiving this email because {inviterName} invited
                you to {storeName}.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
