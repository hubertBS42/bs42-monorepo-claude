import { Section, Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"

interface OrderShippedProps {
  customerName: string
  reference: string
  shippingAddress: string
  note?: string | null
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const OrderShipped = ({ customerName, reference, shippingAddress, note, appName, logoUrl }: OrderShippedProps) => {
  return (
    <OrderLayout preview={`Your order ${reference} is on its way`} heading="Your Order is On Its Way" appName={appName} logoUrl={logoUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
        Your order <strong className="text-[#18181b]">{reference}</strong> has been dispatched and is on its way to you.
      </Text>

      <Section className="rounded-md bg-gray-50 p-4">
        <Text className="m-0 font-semibold text-[#71717a]">Delivery Address</Text>
        <Text className="m-0 text-sm text-gray-500">{shippingAddress}</Text>
      </Section>

      {note && (
        <Section className="mt-4 rounded-md bg-gray-50 p-4">
          <Text className="m-0 text-sm text-gray-500">Note: {note}</Text>
        </Section>
      )}

      <Text className="mt-6 text-sm text-gray-500">We will notify you once your order has been delivered.</Text>
    </OrderLayout>
  )
}

export default OrderShipped
