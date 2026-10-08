import { INVITATION_EXPIRATION_SECONDS } from "@workspace/contracts"
import { formatDuration } from "../formatters.js"
import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Tailwind, Text } from "react-email"

interface InviteMemberEmailProps {
  name: string
  inviterName: string
  storeName: string
  role: string
  url: string
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const InviteMemberEmail = ({ name, inviterName, storeName, role, url, appName, logoUrl }: InviteMemberEmailProps) => {
  const previewText = `${inviterName} invited you to join ${storeName} on ${appName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="m-auto bg-[#f4f4f5] font-sans">
          <Container className="mx-auto my-10 max-w-120">
            {/* Header */}
            <Section className="rounded-t-xl bg-[#18181b] px-10 py-8 text-center">
              {logoUrl ? <Img src={logoUrl} width="90" alt={appName} className="mx-auto" /> : <Text className="m-0 text-lg font-semibold text-white">{appName}</Text>}
            </Section>

            {/* Body */}
            <Section className="bg-white px-10 py-8">
              <Heading className="m-0 mb-2 text-xl font-semibold text-[#18181b]">You&apos;ve been invited</Heading>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {name},</Text>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                <strong className="text-[#18181b]">{inviterName}</strong> has invited you to join <strong className="text-[#18181b]">{storeName}</strong> on {appName} as a{" "}
                <strong className="text-[#18181b]">{role}</strong>.
              </Text>

              <Section className="my-8 text-center">
                <Button href={url} className="rounded-lg bg-[#18181b] px-6 py-3 text-sm font-medium text-white no-underline">
                  Accept Invitation
                </Button>
              </Section>

              <Hr className="my-6 border-[#e4e4e7]" />

              <Text className="text-xs leading-relaxed text-[#71717a]">
                This invitation will expire in <strong>{formatDuration(INVITATION_EXPIRATION_SECONDS)}</strong>. If you weren&apos;t expecting this invitation, you can safely ignore this email.
              </Text>

              <Text className="mt-0 text-xs text-[#71717a]">If the button above doesn&apos;t work, copy and paste this URL into your browser:</Text>
              <Text className="mt-0 text-xs break-all text-[#18181b]">{url}</Text>
            </Section>

            {/* Footer */}
            <Section className="rounded-b-xl border border-t-0 border-[#e4e4e7] bg-[#fafafa] px-10 py-6">
              <Text className="m-0 text-center text-xs text-[#a1a1aa]">
                © {new Date().getFullYear()} {appName}. All rights reserved.
              </Text>
              <Text className="m-0 mt-1 text-center text-xs text-[#a1a1aa]">
                You&apos;re receiving this email because {inviterName} invited you to {storeName}.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
