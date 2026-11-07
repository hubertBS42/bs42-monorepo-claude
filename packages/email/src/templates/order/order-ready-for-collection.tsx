import { Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"
import { PickupDetails, type PickupLocation } from "./components/pickup-details.js"

interface OrderReadyForCollectionProps {
  customerName: string
  reference: string
  paid: boolean
  pickup?: PickupLocation | null
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
  /** The order's page on the storefront, with its progress and invoice */
  orderUrl?: string | null
}

export const OrderReadyForCollection = ({ customerName, reference, paid, pickup, appName, logoUrl, orderUrl }: OrderReadyForCollectionProps) => {
  return (
    <OrderLayout preview={`Your order ${reference} is ready to collect`} heading="Ready for Collection" appName={appName} logoUrl={logoUrl} orderUrl={orderUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
        Your order <strong className="text-[#18181b]">{reference}</strong> is ready to collect.{!paid && " Payment is due when you collect it."}
      </Text>
      {pickup && <PickupDetails location={pickup} />}
    </OrderLayout>
  )
}

export default OrderReadyForCollection
