import { Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"

interface OrderDeliveredProps {
  customerName: string
  reference: string
  note?: string | null
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const OrderDelivered = ({ customerName, reference, note, appName, logoUrl }: OrderDeliveredProps) => {
  return (
    <OrderLayout preview={`Your order ${reference} has been delivered`} heading="Order Delivered" appName={appName} logoUrl={logoUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
        Your order <strong className="text-[#18181b]">{reference}</strong> has been delivered. We hope you enjoy your purchase!
      </Text>

      {note && <Text className="text-sm text-gray-500">Note: {note}</Text>}

      <Text className="mt-6 text-sm text-gray-500">If you have any issues with your order, please contact us and we will be happy to help.</Text>
    </OrderLayout>
  )
}

export default OrderDelivered
