import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Tailwind, Text } from "react-email"

interface TradeAccountDecisionEmailProps {
  name: string
  companyName: string
  // Approved with a discount (a percentage), or rejected with the reason the customer is shown
  decision: { approved: true; percent: number } | { approved: false; reason: string }
  /** The storefront's trade account page */
  url: string
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

// Sent when the platform's staff approve or reject a storefront customer's trade account application
export const TradeAccountDecisionEmail = ({ name, companyName, decision, url, appName, logoUrl }: TradeAccountDecisionEmailProps) => {
  const previewText = decision.approved ? `Your trade account for ${companyName} is approved` : `About your trade account application for ${companyName}`

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
              <Heading className="m-0 mb-2 text-xl font-semibold text-[#18181b]">{decision.approved ? "Trade account approved" : "Trade account application"}</Heading>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {name},</Text>
              {decision.approved ? (
                <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                  Good news: the trade account for <strong className="text-[#18181b]">{companyName}</strong> is approved. You get <strong className="text-[#18181b]">{decision.percent}% off</strong>{" "}
                  everything, before tax. Sign in to see your prices; your orders&apos; invoices carry your company name and TIN.
                </Text>
              ) : (
                <>
                  <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                    We couldn&apos;t approve the trade account for <strong className="text-[#18181b]">{companyName}</strong> this time.
                  </Text>
                  <Section className="rounded-md bg-gray-50 p-4">
                    <Text className="m-0 text-sm text-gray-500">Reason: {decision.reason}</Text>
                  </Section>
                  <Text className="text-sm leading-relaxed text-[#71717a]">You&apos;re welcome to apply again with corrected details.</Text>
                </>
              )}

              <Section className="my-8 text-center">
                <Button href={url} className="rounded-lg bg-[#18181b] px-6 py-3 text-sm font-medium text-white no-underline">
                  {decision.approved ? "View Trade Account" : "Apply Again"}
                </Button>
              </Section>

              <Hr className="my-6 border-[#e4e4e7]" />

              <Text className="mt-0 text-xs text-[#71717a]">If the button above doesn&apos;t work, copy and paste this URL into your browser:</Text>
              <Text className="mt-0 text-xs break-all text-[#18181b]">{url}</Text>
            </Section>

            {/* Footer */}
            <Section className="rounded-b-xl border border-t-0 border-[#e4e4e7] bg-[#fafafa] px-10 py-6">
              <Text className="m-0 text-center text-xs text-[#a1a1aa]">
                © {new Date().getFullYear()} {appName}. All rights reserved.
              </Text>
              <Text className="m-0 mt-1 text-center text-xs text-[#a1a1aa]">You&apos;re receiving this email because you applied for a trade account.</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
