import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Tailwind, Text } from "react-email"

interface QuoteEmailProps {
  name: string
  reference: string
  /** The total, formatted ("GH₵1,234.50") */
  total: string
  /** The last day its prices hold, formatted */
  validUntil: string
  url: string
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
  /** The staff member's first name when the quotation was made for the customer; left out when they made it themselves */
  preparedBy?: string | null
}

// Sent when a customer makes a quotation from their basket, or staff make one for them: its link, which they can forward
// to whoever approves the purchase
export const QuoteEmail = ({ name, reference, total, validUntil, url, appName, logoUrl, preparedBy }: QuoteEmailProps) => {
  const previewText = `Your quotation ${reference}, valid until ${validUntil}`

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
              <Heading className="m-0 mb-2 text-xl font-semibold text-[#18181b]">Quotation {reference}</Heading>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {name},</Text>
              <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
                {preparedBy ? `${preparedBy} at ${appName} has prepared a quotation for you, for ` : "Here's your quotation for "}
                <strong className="text-[#18181b]">{total}</strong>. Its prices hold until <strong className="text-[#18181b]">{validUntil}</strong>; the items aren&apos;t reserved, so they&apos;re
                subject to availability. Print it or forward this link to whoever approves the purchase, then accept it to pay.
              </Text>

              <Section className="my-8 text-center">
                <Button href={url} className="rounded-lg bg-[#18181b] px-6 py-3 text-sm font-medium text-white no-underline">
                  View Quotation
                </Button>
              </Section>

              <Hr className="my-6 border-[#e4e4e7]" />

              <Text className="text-xs leading-relaxed text-[#71717a]">
                {preparedBy
                  ? "Anyone with this link can see the quotation. To accept it, sign in with this email address, or create an account with it. To pay by bank transfer instead, reply to us."
                  : "Anyone with this link can see the quotation, but only you can accept it."}
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
                {preparedBy ? "You're receiving this email because we prepared a quotation for you." : "You're receiving this email because you made a quotation on our website."}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
