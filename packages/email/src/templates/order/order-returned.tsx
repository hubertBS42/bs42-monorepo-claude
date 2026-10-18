import { Section, Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"
import { formatCurrencyGhs } from "../../formatters.js"

export interface ReturnedItem {
  productName: string
  variantDescription: string | null
  quantity: number
}

interface OrderReturnedProps {
  customerName: string
  reference: string
  items: ReturnedItem[]
  returnReason: string
  /** What was refunded for the return; null when nothing was */
  refundAmountGhs: number | null
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const OrderReturned = ({ customerName, reference, items, returnReason, refundAmountGhs, appName, logoUrl }: OrderReturnedProps) => {
  return (
    <OrderLayout preview={`We've received your return for order ${reference}`} heading="Return Received" appName={appName} logoUrl={logoUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
        We&apos;ve received the items you returned from order <strong className="text-[#18181b]">{reference}</strong>.
      </Text>

      <Section className="rounded-md bg-gray-50 p-4">
        <Text className="m-0 font-semibold text-gray-700">Returned Items</Text>
        {items.map((item, index) => (
          <Text key={index} className="m-0 text-sm text-gray-500">
            {item.quantity} × {item.productName}
            {item.variantDescription ? ` (${item.variantDescription})` : ""}
          </Text>
        ))}
        <Text className="mt-3 mb-0 font-semibold text-gray-700">Reason</Text>
        <Text className="m-0 text-sm text-gray-500">{returnReason}</Text>
      </Section>

      {refundAmountGhs !== null && <Text className="mt-4 text-sm text-gray-500">A refund of {formatCurrencyGhs(refundAmountGhs)} has been processed.</Text>}

      <Text className="text-sm text-gray-500">If you have any questions, please contact us.</Text>
    </OrderLayout>
  )
}

export default OrderReturned
