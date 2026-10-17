import { Section, Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"

interface OrderConfirmedProps {
  customerName: string
  reference: string
  note?: string | null
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const OrderConfirmed = ({ customerName, reference, note, appName, logoUrl }: OrderConfirmedProps) => {
  return (
    <OrderLayout preview={`Your order ${reference} has been confirmed`} heading="Order Confirmed" appName={appName} logoUrl={logoUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
        Great news! Your order <strong className="text-[#18181b]">{reference}</strong> has been confirmed. We are now preparing your order.
      </Text>

      {note && (
        <Section className="rounded-md bg-gray-50 p-4">
          <Text className="m-0 text-sm text-gray-500">Note: {note}</Text>
        </Section>
      )}

      <Text className="mt-6 text-sm text-gray-500">We will be in touch when it&apos;s ready.</Text>
    </OrderLayout>
  )
}

export default OrderConfirmed
