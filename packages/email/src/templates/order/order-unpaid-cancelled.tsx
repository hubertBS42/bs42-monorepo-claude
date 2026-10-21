import { Button, Section, Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"

interface OrderUnpaidCancelledProps {
  customerName: string
  reference: string
  // How long the customer had to pay, in minutes
  paymentMinutes: number
  // The order's page, where its items can go back in the basket
  url: string
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

// Sent when a storefront order is cancelled because it wasn't paid in time. Nothing was charged, so it's not a refund
// notice: it says the items were released and how to get them back.
export const OrderUnpaidCancelled = ({ customerName, reference, paymentMinutes, url, appName, logoUrl }: OrderUnpaidCancelledProps) => {
  return (
    <OrderLayout preview={`Your order ${reference} wasn't paid for, so we've cancelled it`} heading="Order Not Completed" appName={appName} logoUrl={logoUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="text-sm leading-relaxed text-[#71717a]">
        We didn&apos;t receive payment for your order <strong>{reference}</strong> within {paymentMinutes} minutes, so we&apos;ve cancelled it and released the items. You haven&apos;t been charged.
      </Text>
      <Text className="text-sm leading-relaxed text-[#71717a]">Still want them? Open your order to put the items back in your basket, at today&apos;s prices and while they&apos;re in stock.</Text>

      <Section className="my-8 text-center">
        <Button href={url} className="rounded-lg bg-[#18181b] px-6 py-3 text-sm font-medium text-white no-underline">
          View Order
        </Button>
      </Section>

      <Text className="text-xs leading-relaxed text-[#71717a]">If you paid and still got this email, contact us with your order reference and we&apos;ll sort it out.</Text>
    </OrderLayout>
  )
}

export default OrderUnpaidCancelled
