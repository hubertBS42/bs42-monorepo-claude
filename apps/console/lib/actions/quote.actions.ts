"use server"

import { after } from "next/server"
import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import { getPricingContext } from "@workspace/commerce/exchange-rates"
import { notifyNewOrder, notifyStockAlerts } from "@workspace/commerce/notifications"
import { sendOrderEmail } from "@workspace/commerce/order-emails"
import { OrderItemError } from "@workspace/commerce/order-writes"
import { sendQuoteEmail } from "@workspace/commerce/quote-emails"
import { QuoteError } from "@workspace/commerce/quotes"
import { loadTradeTerms } from "@workspace/commerce/trade-accounts"
import type { ActionResponse, DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { requireSystemPermission } from "@/lib/auth-guard"
import { createQuoteFormSchema, findQuoteCustomerSchema, previewQuoteSchema, quoteTargetSchema, searchQuotableItemsSchema } from "@/lib/schemas/quote.schemas"
import { cancelStaffQuote, createStaffQuote, placeOrderFromQuote, priceStaffSale, searchQuotableItems, StaffQuoteError, type QuotableProduct } from "@/lib/staff-quotes"
import type { QuoteCustomer, QuotePreview } from "@/types"

// Quotations staff make for customers, in the global workspace (system permission order). Every export here is a
// public endpoint, so every input is validated, and each one calls its guard before its try block (its redirect
// throws, which the catch would swallow).

type Failure = { success: false; error: string; code?: string }

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

const NO_RATE: Failure = {
  success: false,
  error: "There's no current exchange rate, so the quotation can't be priced. Ask a superAdmin to set today's rate in Settings.",
  code: "NO_RATE",
}

function invalidInput(error: z.ZodError): Failure {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

function failure(error: unknown): Failure {
  if (error instanceof QuoteError || error instanceof StaffQuoteError || error instanceof OrderItemError) return { success: false, error: error.message, code: error.code }
  return { success: false, error: formatError(error) }
}

type DiscountInput = { discountType: "NONE" | "FIXED" | "PERCENTAGE"; discountValue: number }

function toDiscount({ discountType, discountValue }: DiscountInput, reason: string) {
  return discountType === "NONE" ? null : { type: discountType, value: new Prisma.Decimal(discountValue), reason }
}

// Products customers can buy, each variant with the offer the storefront would sell, for the items step
export async function searchQuotableItemsAction(input: z.input<typeof searchQuotableItemsSchema>): Promise<DataResponse<QuotableProduct[]>> {
  await requireSystemPermission({ order: ["create"] })

  try {
    const parsed = searchQuotableItemsSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)

    const pricing = await getPricingContext()
    if (!pricing) return NO_RATE
    return { success: true, data: await searchQuotableItems(prisma, pricing, parsed.data.search) }
  } catch (error) {
    return failure(error)
  }
}

// An exact email or phone match only, so staff can't browse the platform's customers
export async function findQuoteCustomerAction(input: z.input<typeof findQuoteCustomerSchema>): Promise<DataResponse<QuoteCustomer | null>> {
  await requireSystemPermission({ order: ["create"] })

  try {
    const parsed = findQuoteCustomerSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { email, phone } = parsed.data
    if (!email && !phone) return { success: false, error: "Enter an email or a phone number.", code: "INVALID" }

    const customer = await prisma.user.findFirst({
      where: email ? { email: email.toLowerCase() } : { phone },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          select: { id: true, name: true, phone: true, line1: true, line2: true, region: true, town: true, isDefault: true },
        },
      },
    })
    if (!customer) return { success: true, data: null }

    const trade = await loadTradeTerms(prisma, customer.id)
    return { success: true, data: { ...customer, trade: trade && { percent: trade.percent.toString(), companyName: trade.companyName } } }
  } catch (error) {
    return failure(error)
  }
}

// The review step's prices, from the same code createQuoteAction prices with
export async function previewQuoteAction(input: z.input<typeof previewQuoteSchema>): Promise<DataResponse<QuotePreview>> {
  await requireSystemPermission({ order: ["create"] })

  try {
    const parsed = previewQuoteSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const data = parsed.data

    const pricing = await getPricingContext()
    if (!pricing) return NO_RATE

    const { lines, priced } = await priceStaffSale(prisma, pricing, {
      items: data.items,
      region: data.shippingRegion,
      town: data.shippingTown,
      shippingGhs: new Prisma.Decimal(data.shippingGhs),
      discount: toDiscount(data, ""),
    })
    return {
      success: true,
      data: {
        lines: lines.map((line, index) => {
          const amounts = priced.lines[index]!
          return {
            key: `${line.listingId}:${line.listingVariantId ?? ""}`,
            label: line.label,
            quantity: line.quantity,
            unitPriceGhs: amounts.unitPriceGhs.toFixed(2),
            totalPriceGhs: amounts.totalPriceGhs.toFixed(2),
            installationGhs: amounts.installationUnitGhs ? amounts.installationTotalGhs.toFixed(2) : null,
            stock: line.trackInventory ? line.stock : null,
          }
        }),
        subtotalGhs: priced.subtotalGhs.toFixed(2),
        discountAmountGhs: priced.discountAmountGhs?.toFixed(2) ?? null,
        installationGhs: priced.installationGhs.toFixed(2),
        shippingGhs: priced.shippingGhs.toFixed(2),
        taxRate: priced.taxRate.toString(),
        taxGhs: priced.taxGhs.toFixed(2),
        totalGhs: priced.totalGhs.toFixed(2),
        exchangeRate: pricing.rate.rate,
      },
    }
  } catch (error) {
    return failure(error)
  }
}

// Saves the quotation and emails it to the customer
export async function createQuoteAction(input: z.input<typeof createQuoteFormSchema>): Promise<DataResponse<{ id: string; reference: string }>> {
  const session = await requireSystemPermission({ order: ["create"] })

  try {
    const parsed = createQuoteFormSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const data = parsed.data

    const pricing = await getPricingContext()
    if (!pricing) return NO_RATE

    const quote = await prisma.$transaction(
      (tx) =>
        createStaffQuote(
          tx,
          pricing,
          {
            customerUserId: data.customerUserId,
            name: data.customerName,
            email: data.customerEmail,
            phone: data.customerPhone,
            line1: data.shippingLine1,
            line2: data.shippingLine2,
            region: data.shippingRegion,
            town: data.shippingTown,
            items: data.items,
            shippingGhs: new Prisma.Decimal(data.shippingGhs),
            discount: toDiscount(data, data.discountReason),
            validityDays: data.validityDays,
            notes: data.notes,
          },
          session.user.id
        ),
      TRANSACTION_OPTIONS
    )
    // Only once the quote is saved: after() also runs when an action fails
    after(() => sendQuoteEmail(quote.id))
    return { success: true, data: quote }
  } catch (error) {
    return failure(error)
  }
}

// For a customer who pays by bank transfer: the order at the quote's prices, unpaid, for staff to record the payment
export async function placeOrderFromQuoteAction(input: z.input<typeof quoteTargetSchema>): Promise<ActionResponse> {
  const session = await requireSystemPermission({ order: ["create"] })

  try {
    const parsed = quoteTargetSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)

    const { stockAlerts, ...order } = await prisma.$transaction((tx) => placeOrderFromQuote(tx, parsed.data.quoteId, session.user.id), TRANSACTION_OPTIONS)
    after(async () => {
      await sendOrderEmail(order.id, "CREATED")
      await notifyNewOrder(order.id, "platform")
      await notifyStockAlerts(stockAlerts)
    })
    return { success: true }
  } catch (error) {
    return failure(error)
  }
}

export async function cancelQuoteAction(input: z.input<typeof quoteTargetSchema>): Promise<ActionResponse> {
  await requireSystemPermission({ order: ["update"] })

  try {
    const parsed = quoteTargetSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)

    await cancelStaffQuote(prisma, parsed.data.quoteId)
    return { success: true }
  } catch (error) {
    return failure(error)
  }
}
