import Link from "next/link"
import z from "zod"
import { EXCHANGE_RATE_MAX_AGE_DAYS, getLatestExchangeRate } from "@workspace/commerce/exchange-rates"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import QuoteForm from "@/components/quotes/quote-form"
import { tradeDiscountReason } from "@/components/staff-sales/form"
import { getAppSettings } from "@/lib/app-settings"
import { getDeliverySettings } from "@/lib/data/delivery.data"
import { getInstallationAreas } from "@/lib/data/installation.data"
import { getPickupLocationNames } from "@/lib/data/pickup-locations.data"
import { getQuoteCopy } from "@/lib/data/quotes.data"

interface NewQuotationProps {
  // The store making it; null on the platform's page
  storeId: string | null
  // A quotation to copy
  from?: string
  canChooseDiscount: boolean
}

// The new-quotation page, for the page's own guard to wrap
export default async function NewQuotation({ storeId, from, canChooseDiscount }: NewQuotationProps) {
  // The actions check the rate again when pricing; this only saves filling in a form that can't be sent
  const [rate, delivery, installation, settings, copy, pickupLocations] = await Promise.all([
    getLatestExchangeRate(),
    getDeliverySettings(),
    getInstallationAreas(),
    getAppSettings(),
    from && z.uuid().safeParse(from).success ? getQuoteCopy(from, storeId) : null,
    getPickupLocationNames(),
  ])

  if (copy && !canChooseDiscount) {
    const trade = copy.customer?.trade
    copy.values = {
      ...copy.values,
      discountType: trade ? "PERCENTAGE" : "NONE",
      discountValue: trade ? Number(trade.percent) : 0,
      discountReason: trade ? tradeDiscountReason(trade.percent) : "",
    }
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">New Quotation</h1>
        <p className="text-sm text-muted-foreground">
          {copy
            ? `A copy of ${copy.reference} at today's prices.${copy.left ? ` ${copy.left === 1 ? "One line was" : `${copy.left} lines were`} left out: no longer on sale.` : ""}`
            : "Emailed to the customer to accept."}
        </p>
      </div>

      {!rate || rate.isStale ? (
        <Card>
          <CardHeader>
            <CardTitle>Quotations can&apos;t be priced right now</CardTitle>
            <CardDescription>
              {`Prices are converted from USD at the latest exchange rate, and ${rate ? `the latest one is more than ${EXCHANGE_RATE_MAX_AGE_DAYS} days old` : "no rate has been set"}. Ask a superAdmin to set today's rate in Settings.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={storeId ? "/store/quotes" : "/quotes"} className={buttonVariants({ variant: "outline" })}>
              Back to quotations
            </Link>
          </CardContent>
        </Card>
      ) : (
        <QuoteForm storeId={storeId} delivery={delivery} installationAreas={installation.areas} validityDays={settings.quoteValidityDays} copy={copy} pickupLocations={pickupLocations} />
      )}
    </div>
  )
}
