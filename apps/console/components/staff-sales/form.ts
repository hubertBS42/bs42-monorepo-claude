import type { UseFormReturn } from "react-hook-form"
import type { QuoteCustomer } from "@/types"

// What the platform's two create wizards share: a quotation (/quotes/create) and an order (/orders/create) are both
// sold as the storefront would sell them, to a customer staff look up or type in, delivered to an address.

export type StaffSaleKind = "quote" | "order"

// The fields every step here reads or writes, as the forms hold them
export interface StaffSaleFields {
  customerUserId: string | null
  customerName: string
  customerEmail: string
  customerPhone: string
  items: { listingId: string; listingVariantId: string | null; quantity: number; installation: boolean }[]
  shippingLine1: string
  shippingLine2: string
  shippingRegion: string
  shippingTown: string
  shippingGhs: number
  discountType: "NONE" | "FIXED" | "PERCENTAGE"
  discountValue: number
  discountReason: string
}

// A wizard's form, which has these fields among its own
export type StaffSaleForm<T extends StaffSaleFields, O> = UseFormReturn<T, unknown, O>

// react-hook-form's types don't let a form with more fields stand in for one with fewer, so each step reads its form
// through this one cast. The `T extends StaffSaleFields` on the steps' props checks the fields are there.
export function asStaffSaleForm<T extends StaffSaleFields, O>(form: StaffSaleForm<T, O>) {
  return form as unknown as UseFormReturn<StaffSaleFields>
}

export const itemKey = (listingId: string, listingVariantId: string | null) => `${listingId}:${listingVariantId ?? ""}`

// "Trade discount (10%)", as the storefront words a trade account's discount
export const tradeDiscountReason = (percent: string) => `Trade discount (${Number(percent)}%)`

// A trade account's discount is where the review step starts; staff can change it. A discount staff set themselves
// stays when the customer changes.
export function setTradeDiscount(form: UseFormReturn<StaffSaleFields>, trade: QuoteCustomer["trade"]) {
  const current = form.getValues()
  const isTradeDiscount = current.discountType === "NONE" || current.discountReason.startsWith("Trade discount")
  if (!isTradeDiscount) return
  if (trade) {
    form.setValue("discountType", "PERCENTAGE")
    form.setValue("discountValue", Number(trade.percent))
    form.setValue("discountReason", tradeDiscountReason(trade.percent))
  } else {
    form.setValue("discountType", "NONE")
    form.setValue("discountValue", 0)
    form.setValue("discountReason", "")
  }
}

// The details stay as typed, no longer tied to the account (nor its trade discount)
export function unlinkCustomer<T extends StaffSaleFields, O>(wizardForm: StaffSaleForm<T, O>) {
  const form = asStaffSaleForm(wizardForm)
  form.setValue("customerUserId", null)
  setTradeDiscount(form, null)
}
