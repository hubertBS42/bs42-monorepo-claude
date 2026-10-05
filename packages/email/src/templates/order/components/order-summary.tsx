import { Column, Row, Section, Text, Hr } from "react-email"
import { formatCurrencyGhs } from "../../../formatters.js"

interface OrderItem {
  productName: string
  variantDescription: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  exchangeRate: number
}

interface OrderSummaryProps {
  items: OrderItem[]
  subtotalGhs: number
  shippingPrice: number
  taxPrice: number
  discountAmount: number | null
  totalPrice: number
  discountReason?: string | null
  discountType?: string | null
  discountValue?: number | null
}

const fmt = formatCurrencyGhs

export const OrderSummary = ({
  items,
  subtotalGhs,
  shippingPrice,
  taxPrice,
  discountAmount,
  totalPrice,
  discountReason,
  discountType,
  discountValue,
}: OrderSummaryProps) => {
  return (
    <Section>
      <Text className="mb-2 font-semibold text-[#18181b]">Order Items</Text>

      {items.map((item, index) => (
        <Row key={index} className="mb-2">
          <Column className="flex-1">
            <Text className="m-0 text-sm text-gray-900">
              {item.productName}
            </Text>
            {item.variantDescription && (
              <Text className="m-0 text-xs text-[#71717a]">
                {item.variantDescription}
              </Text>
            )}
            <Text className="m-0 text-xs text-[#71717a]">
              Qty: {item.quantity}
            </Text>
          </Column>
          <Column className="text-right">
            <Text className="m-0 text-sm text-gray-900">
              {fmt(item.totalPrice * item.exchangeRate)}
            </Text>
          </Column>
        </Row>
      ))}

      <Hr className="my-4 border-[#e4e4e7]" />

      {/* Totals */}
      <Row className="mb-1">
        <Column className="flex-1">
          <Text className="m-0 text-sm text-[#71717a]">Subtotal</Text>
        </Column>
        <Column className="text-right">
          <Text className="m-0 text-sm text-gray-900">{fmt(subtotalGhs)}</Text>
        </Column>
      </Row>

      <Row className="mb-1">
        <Column className="flex-1">
          <Text className="m-0 text-sm text-[#71717a]">Shipping</Text>
        </Column>
        <Column className="text-right">
          <Text className="m-0 text-sm text-gray-900">
            {fmt(shippingPrice)}
          </Text>
        </Column>
      </Row>

      {taxPrice > 0 && (
        <Row className="mb-1">
          <Column className="flex-1">
            <Text className="m-0 text-sm text-[#71717a]">Tax</Text>
          </Column>
          <Column className="text-right">
            <Text className="m-0 text-sm text-gray-900">{fmt(taxPrice)}</Text>
          </Column>
        </Row>
      )}

      {discountAmount && discountAmount > 0 && (
        <Row className="mb-1">
          <Column className="flex-1">
            <Text className="m-0 text-sm text-[#71717a]">
              Discount
              {discountType === "PERCENTAGE" &&
                discountValue &&
                ` (${discountValue}%)`}
              {discountReason && ` · ${discountReason}`}
            </Text>
          </Column>
          <Column className="text-right">
            <Text className="m-0 text-sm text-red-500">
              -{fmt(discountAmount)}
            </Text>
          </Column>
        </Row>
      )}

      <Hr className="my-4 border-[#e4e4e7]" />

      <Row>
        <Column className="flex-1">
          <Text className="m-0 font-semibold text-gray-900">Total</Text>
        </Column>
        <Column className="text-right">
          <Text className="m-0 font-semibold text-gray-900">
            {fmt(totalPrice)}
          </Text>
        </Column>
      </Row>
    </Section>
  )
}
