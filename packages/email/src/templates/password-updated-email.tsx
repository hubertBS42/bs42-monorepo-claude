import { Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Tailwind, Text } from "react-email"

interface PasswordUpdatedEmailProps {
  name: string
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const PasswordUpdatedEmail = ({ name, appName, logoUrl }: PasswordUpdatedEmailProps) => {
  const previewText = `Your ${appName} password has been updated`

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
              <Heading className="m-0 mb-2 text-xl font-semibold text-[#18181b]">Password updated</Heading>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {name},</Text>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Your {appName} account password was successfully updated.</Text>

              <Hr className="my-6 border-[#e4e4e7]" />

              <Text className="text-xs leading-relaxed text-[#71717a]">
                If you didn&apos;t make this change, please reset your password immediately or contact our support team — your account may have been compromised.
              </Text>
            </Section>

            {/* Footer */}
            <Section className="rounded-b-xl border border-t-0 border-[#e4e4e7] bg-[#fafafa] px-10 py-6">
              <Text className="m-0 text-center text-xs text-[#a1a1aa]">
                © {new Date().getFullYear()} {appName}. All rights reserved.
              </Text>
              <Text className="m-0 mt-1 text-center text-xs text-[#a1a1aa]">You&apos;re receiving this email because your account password was recently changed.</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
