import "server-only"

import { prisma, readAppSettings, resolveStoreName } from "@workspace/db"
import { QuoteEmail, sendEmail } from "@workspace/email"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import { quoteUrl } from "./order-links"

// "Kofi" from "Kofi Mensah"; staff without a name are "Our team"
const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || "Our team"

// The customer's copy of a quotation, in the storefront's name, with the link to forward: when they make one from
// their basket, and when staff make one for them. Never throws: callers run it with after(), once the quote is saved.
export async function sendQuoteEmail(quoteId: string) {
  try {
    const [quote, settings] = await Promise.all([
      prisma.quote.findUnique({
        where: { id: quoteId },
        select: { reference: true, customerName: true, customerEmail: true, totalGhs: true, validUntil: true, createdBy: { select: { name: true } } },
      }),
      readAppSettings(),
    ])
    if (!quote) return
    const appName = resolveStoreName(settings)
    await sendEmail({
      to: quote.customerEmail,
      fromName: appName,
      subject: `Your quotation ${quote.reference}`,
      reactTemplate: QuoteEmail({
        name: quote.customerName.split(" ")[0] || quote.customerName,
        reference: quote.reference,
        total: formatCurrency(quote.totalGhs.toFixed(2), "GHS", "en-GH"),
        // validUntil is the start of the day after the last one
        validUntil: formatDate(new Date(quote.validUntil.getTime() - 1), "EEEE d MMMM"),
        url: quoteUrl(quote.reference, quoteId),
        appName,
        logoUrl: settings.logoUrl,
        // A staff member's first name, for a quote made in the console
        preparedBy: quote.createdBy ? firstName(quote.createdBy.name) : null,
      }),
    })
  } catch (error) {
    console.error(`Could not send the quotation email for ${quoteId}:`, error)
  }
}
