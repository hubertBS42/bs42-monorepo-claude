import { Section, Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"
import { formatCurrencyGhs } from "../../formatters.js"

interface OrderCancelledProps {
  customerName: string
  reference: string
  cancellationReason: string
  totalPrice: number
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const OrderCancelled = ({ customerName, reference, cancellationReason, totalPrice, appName, logoUrl }: OrderCancelledProps) => {
  return (
    <OrderLayout preview={`Your order ${reference} has been cancelled`} heading="Order Cancelled" appName={appName} logoUrl={logoUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="text-[#71717a]">
        Unfortunately your order <strong>{reference}</strong> has been cancelled.
      </Text>

      <Section className="rounded-md bg-gray-50 p-4">
        <Text className="m-0 font-semibold text-[#71717a]">Cancellation Reason</Text>
        <Text className="m-0 text-sm text-gray-500">{cancellationReason}</Text>
      </Section>

      <Text className="mt-4 text-sm text-gray-500">Total order value was {formatCurrencyGhs(totalPrice)}. If any payment was made, a refund will be processed shortly.</Text>

      <Text className="text-sm text-gray-500">If you have any questions, please contact us.</Text>
    </OrderLayout>
  )
}

export default OrderCancelled
