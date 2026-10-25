import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Tailwind, Text } from "react-email"
import { DARK_FILL } from "./dark-fill.js"

// Staff notifications (new orders, stock alerts, a failed exchange-rate fetch): a heading, a line of context, the
// details as label and value rows, and optionally a button into the console. The console builds each kind.

interface StaffAlertEmailProps {
  preview: string
  heading: string
  intro: string
  details: { label: string; value: string }[]
  action?: { label: string; url: string } | null
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const StaffAlertEmail = ({ preview, heading, intro, details, action, appName, logoUrl }: StaffAlertEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="m-auto bg-[#f4f4f5] font-sans">
          <Container className="mx-auto my-10 max-w-120">
            {/* Header */}
            <Section className="rounded-t-xl bg-[#18181b] px-10 py-8 text-center" style={DARK_FILL}>
              {logoUrl ? <Img src={logoUrl} width="90" alt={appName} className="mx-auto" /> : <Text className="m-0 text-lg font-semibold text-white">{appName}</Text>}
            </Section>

            {/* Body */}
            <Section className="bg-white px-10 py-8">
              <Heading className="m-0 mb-2 text-xl font-semibold text-[#18181b]">{heading}</Heading>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">{intro}</Text>

              {details.length > 0 && (
                <Section className="rounded-md bg-gray-50 p-4">
                  {details.map((detail) => (
                    <Text key={detail.label} className="m-0 text-sm text-gray-500">
                      {`${detail.label}: `}
                      <strong className="text-[#18181b]">{detail.value}</strong>
                    </Text>
                  ))}
                </Section>
              )}

              {action && (
                <Section className="mt-8 text-center">
                  <Button href={action.url} className="rounded-lg bg-[#18181b] px-6 py-3 text-sm font-medium text-white no-underline">
                    {action.label}
                  </Button>
                </Section>
              )}
            </Section>

            {/* Footer */}
            <Section className="rounded-b-xl border border-t-0 border-[#e4e4e7] bg-[#fafafa] px-10 py-6">
              <Text className="m-0 text-center text-xs text-[#a1a1aa]">
                © {new Date().getFullYear()} {appName}. All rights reserved.
              </Text>
              <Text className="m-0 mt-1 text-center text-xs text-[#a1a1aa]">You&apos;re receiving this because your address is on the notification list in {appName}&apos;s settings.</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default StaffAlertEmail
