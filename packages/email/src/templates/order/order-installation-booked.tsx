import { Section, Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"

interface OrderInstallationBookedProps {
  customerName: string
  reference: string
  /** The booked day, as the customer reads it */
  date: string
  note?: string | null
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const OrderInstallationBooked = ({ customerName, reference, date, note, appName, logoUrl }: OrderInstallationBookedProps) => {
  return (
    <OrderLayout preview={`Installation for ${reference} is booked for ${date}`} heading="Installation Booked" appName={appName} logoUrl={logoUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
        The installation for your order <strong className="text-[#18181b]">{reference}</strong> is booked for <strong className="text-[#18181b]">{date}</strong>.
      </Text>

      {note && (
        <Section className="rounded-md bg-gray-50 p-4">
          <Text className="m-0 text-sm text-gray-500">Note: {note}</Text>
        </Section>
      )}

      <Text className="mt-6 text-sm text-gray-500">If that day doesn&apos;t suit you, reply to this email or call us and we&apos;ll find another.</Text>
    </OrderLayout>
  )
}

export default OrderInstallationBooked
