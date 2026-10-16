import { Section, Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"
import { OrderSummary, type OrderSummaryItem } from "./components/order-summary.js"

interface OrderConfirmationProps {
  customerName: string
  reference: string
  items: OrderSummaryItem[]
  subtotalGhs: number
  shippingGhs: number
  taxGhs: number
  discountAmountGhs: number | null
  discountType: string | null
  discountValue: number | null
  discountReason: string | null
  totalGhs: number
  shippingMethod: string
  shippingAddress?: string | null
  paymentMethod: string
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

export const OrderConfirmation = ({
  customerName,
  reference,
  items,
  subtotalGhs,
  shippingGhs,
  taxGhs,
  discountAmountGhs,
  discountType,
  discountValue,
  discountReason,
  totalGhs,
  shippingMethod,
  shippingAddress,
  paymentMethod,
  appName,
  logoUrl,
}: OrderConfirmationProps) => {
  return (
    <OrderLayout preview={`Order ${reference} confirmed — thank you for your order!`} heading="Order Confirmation" appName={appName} logoUrl={logoUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">
        Thank you for your order! We have received your order and it is being reviewed. Your order reference is <strong className="text-[#18181b]">{reference}</strong>.
      </Text>

      <OrderSummary
        items={items}
        subtotalGhs={subtotalGhs}
        shippingGhs={shippingGhs}
        taxGhs={taxGhs}
        discountAmountGhs={discountAmountGhs}
        discountType={discountType}
        discountValue={discountValue}
        discountReason={discountReason}
        totalGhs={totalGhs}
      />

      {/* Delivery info */}
      <Section className="mt-6 rounded-md bg-gray-50 p-4">
        <Text className="m-0 font-semibold text-[#71717a]">Delivery Information</Text>
        <Text className="m-0 text-sm text-gray-500">Method: {shippingMethod === "PICKUP" ? "Store Pickup" : "Delivery"}</Text>
        {shippingAddress && <Text className="m-0 text-sm text-gray-500">Address: {shippingAddress}</Text>}
        <Text className="m-0 text-sm text-gray-500">Payment: {paymentMethod} (due on delivery)</Text>
      </Section>

      <Text className="mt-6 text-sm text-gray-500">We will notify you when your order status changes. If you have any questions, please contact us.</Text>
    </OrderLayout>
  )
}

export default OrderConfirmation
