import { Button, Column, Img, Row, Section, Text } from "react-email"
import { OrderLayout } from "./components/order-layout.js"

export interface ReviewRequestItem {
  productName: string
  /** Absolute https URL of the product's first image, if it has one */
  imageUrl: string | null
  /** The storefront's page for writing this product's review (it asks the customer to sign in first) */
  reviewUrl: string
}

interface OrderReviewRequestProps {
  customerName: string
  reference: string
  items: ReviewRequestItem[]
  appName: string
  /** Absolute https URL of the uploaded logo. When missing, the app name is shown as text instead. */
  logoUrl?: string | null
}

// Sent when an order is completed: asks for a review of each product on it the customer hasn't reviewed yet
export const OrderReviewRequest = ({ customerName, reference, items, appName, logoUrl }: OrderReviewRequestProps) => {
  return (
    <OrderLayout preview={`How was your order ${reference}?`} heading="How Was Your Order?" appName={appName} logoUrl={logoUrl}>
      <Text className="mt-0 text-sm leading-relaxed text-[#71717a]">Hi {customerName},</Text>
      <Text className="text-sm leading-relaxed text-[#71717a]">
        Thanks for shopping with us. Your order <strong className="text-[#18181b]">{reference}</strong> is complete. Would you tell other customers what you think of{" "}
        {items.length === 1 ? "it" : "what you bought"}? A review takes a minute.
      </Text>

      <Section className="my-6">
        {items.map((item, index) => (
          <Row key={index} className="mb-3 rounded-md bg-gray-50 p-3">
            <Column className="w-14 align-middle">{item.imageUrl ? <Img src={item.imageUrl} alt="" width="48" height="48" className="rounded bg-white object-contain" /> : null}</Column>
            <Column className="align-middle">
              <Text className="m-0 text-sm font-medium text-[#18181b]">{item.productName}</Text>
            </Column>
            <Column className="w-32 text-right align-middle">
              <Button href={item.reviewUrl} className="rounded-lg bg-[#18181b] px-4 py-2 text-xs font-medium text-white no-underline">
                Write a review
              </Button>
            </Column>
          </Row>
        ))}
      </Section>

      <Text className="text-xs leading-relaxed text-[#71717a]">You&apos;ll be asked to sign in, or to create an account with this email address, so we know the review comes from a customer.</Text>
    </OrderLayout>
  )
}

export default OrderReviewRequest
