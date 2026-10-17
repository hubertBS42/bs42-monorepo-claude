import { Section, Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"
import { formatCurrencyGhs } from "../../formatters.js"

interface OrderPaymentReceivedProps {
  customerName: string
  reference: string
  amountGhs: number
  paymentMethod: string
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const OrderPaymentReceived = ({ customerName, reference, amountGhs, paymentMethod, appName, logoUrl }: OrderPaymentReceivedProps) => {
  return (
    <OrderLayout preview={`We've received your payment for order ${reference}`} heading="Payment Received" appName={appName} logoUrl={logoUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
        We&apos;ve received your payment for order <strong className="text-[#18181b]">{reference}</strong>. Thank you!
      </Text>

      <Section className="rounded-md bg-gray-50 p-4">
        <Text className="m-0 text-sm text-gray-500">Amount paid: {formatCurrencyGhs(amountGhs)}</Text>
        <Text className="m-0 text-sm text-gray-500">Payment method: {paymentMethod}</Text>
      </Section>

      <Text className="mt-4 text-sm text-gray-500">Keep this email as your receipt. If you have any questions, please contact us.</Text>
    </OrderLayout>
  )
}

export default OrderPaymentReceived
