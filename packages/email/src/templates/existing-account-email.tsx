import { Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Tailwind, Text } from "react-email"

interface ExistingAccountEmailProps {
  name: string
  signInUrl: string
  resetPasswordUrl: string
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

// Sent when someone signs up with an email that already has an account. Sign-up answers the same either way, so this
// is how the owner of the address finds out, and finds their way in.
export const ExistingAccountEmail = ({ name, signInUrl, resetPasswordUrl, appName, logoUrl }: ExistingAccountEmailProps) => {
  const previewText = `You already have a ${appName} account`

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
              <Heading className="m-0 mb-2 text-xl font-semibold text-[#18181b]">You already have an account</Heading>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {name},</Text>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                Someone just tried to create a {appName} account with this email address, but it already has one. If that was you, sign in instead (with Google, if that&apos;s how you joined).
              </Text>

              <Section className="my-8 text-center">
                <Button href={signInUrl} className="rounded-lg bg-[#18181b] px-6 py-3 text-sm font-medium text-white no-underline">
                  Sign In
                </Button>
              </Section>

              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                Forgotten your password?{" "}
                <Link href={resetPasswordUrl} className="text-[#18181b] underline">
                  Reset it here
                </Link>
                .
              </Text>

              <Hr className="my-6 border-[#e4e4e7]" />

              <Text className="text-xs leading-relaxed text-[#71717a]">If it wasn&apos;t you, you can ignore this email: nothing has changed, and your account is as it was.</Text>
            </Section>

            {/* Footer */}
            <Section className="rounded-b-xl border border-t-0 border-[#e4e4e7] bg-[#fafafa] px-10 py-6">
              <Text className="m-0 text-center text-xs text-[#a1a1aa]">
                © {new Date().getFullYear()} {appName}. All rights reserved.
              </Text>
              <Text className="m-0 mt-1 text-center text-xs text-[#a1a1aa]">You&apos;re receiving this email because someone tried to sign up with this address.</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
