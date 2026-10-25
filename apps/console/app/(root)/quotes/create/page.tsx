import type { Metadata } from "next"
import Link from "next/link"
import z from "zod"
import { EXCHANGE_RATE_MAX_AGE_DAYS, getLatestExchangeRate } from "@workspace/commerce/exchange-rates"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { getStringParam } from "@workspace/utils/search-params"
import QuoteForm from "./_components/quote-form"
import { getAppSettings } from "@/lib/app-settings"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getDeliverySettings } from "@/lib/data/delivery.data"
import { getInstallationAreas } from "@/lib/data/installation.data"
import { getQuoteCopy } from "@/lib/data/quotes.data"

export const metadata: Metadata = {
  title: "New Quotation",
}

type CreateQuotePageProps = {
  // ?from= a quotation to copy
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function CreateQuotePage({ searchParams }: CreateQuotePageProps) {
  await requireSystemPermission({ order: ["create"] })
  const from = getStringParam((await searchParams).from)

  // The actions check the rate again when pricing; this only saves filling in a form that can't be sent
  const [rate, delivery, installation, settings, copy] = await Promise.all([
    getLatestExchangeRate(),
    getDeliverySettings(),
    getInstallationAreas(),
    getAppSettings(),
    from && z.uuid().safeParse(from).success ? getQuoteCopy(from) : null,
  ])

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
            <Link href="/quotes" className={buttonVariants({ variant: "outline" })}>
              Back to quotations
            </Link>
          </CardContent>
        </Card>
      ) : (
        <QuoteForm delivery={delivery} installationAreas={installation.areas} validityDays={settings.quoteValidityDays} copy={copy} />
      )}
    </div>
  )
}
