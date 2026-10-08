import { Body, Container, Head, Heading, Html, Img, Preview, Section, Tailwind, Text } from "react-email"

interface OrderLayoutProps {
  preview: string
  heading: string
  children: React.ReactNode
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const OrderLayout = ({ preview, heading, children, appName, logoUrl }: OrderLayoutProps) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="m-auto bg-[#f4f4f5] font-sans">
          <Container className="mx-auto my-10 max-w-120">
            {/* Header */}
            <Section className="rounded-t-xl bg-[#18181b] px-10 py-8 text-center">
              {logoUrl ? <Img src={logoUrl} width="90" alt={appName} className="mx-auto" /> : <Text className="m-0 text-lg font-semibold text-white">{appName}</Text>}
            </Section>

            {/* Body */}
            <Section className="bg-white px-10 py-8">
              <Heading className="m-0 mb-2 text-xl font-semibold text-[#18181b]">{heading}</Heading>

              {children}
            </Section>

            {/* Footer */}
            <Section className="rounded-b-xl border border-t-0 border-[#e4e4e7] bg-[#fafafa] px-10 py-6">
              <Text className="m-0 text-center text-xs text-[#a1a1aa]">
                © {new Date().getFullYear()} {appName}. All rights reserved.
              </Text>
              <Text className="m-0 mt-1 text-center text-xs text-[#a1a1aa]">You&apos;re receiving this email because you placed an order on {appName}.</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
