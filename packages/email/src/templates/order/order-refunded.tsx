import { Section, Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"
import { formatCurrencyGhs } from "../../formatters.js"

interface OrderRefundedProps {
  customerName: string
  reference: string
  refundReason: string
  refundAmountGhs: number
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const OrderRefunded = ({ customerName, reference, refundReason, refundAmountGhs, appName, logoUrl }: OrderRefundedProps) => {
  return (
    <OrderLayout preview={`Your order ${reference} has been refunded`} heading="Order Refunded" appName={appName} logoUrl={logoUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
        Your order <strong className="text-[#18181b]">{reference}</strong> has been refunded.
      </Text>

      <Section className="rounded-md bg-gray-50 p-4">
        <Text className="m-0 font-semibold text-gray-700">Refund Reason</Text>
        <Text className="m-0 text-sm text-gray-500">{refundReason}</Text>
      </Section>

      <Text className="mt-4 text-sm text-gray-500">A refund of {formatCurrencyGhs(refundAmountGhs)} has been processed.</Text>

      <Text className="text-sm text-gray-500">If you have any questions, please contact us.</Text>
    </OrderLayout>
  )
}

export default OrderRefunded
