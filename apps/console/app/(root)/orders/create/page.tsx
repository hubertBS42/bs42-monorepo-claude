import type { Metadata } from "next"
import Link from "next/link"
import { EXCHANGE_RATE_MAX_AGE_DAYS, getLatestExchangeRate } from "@workspace/commerce/exchange-rates"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import CreateOrderForm from "./_components/create-order-form"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getDeliverySettings } from "@/lib/data/delivery.data"
import { getInstallationAreas } from "@/lib/data/installation.data"

export const metadata: Metadata = {
  title: "Create Order",
}

export default async function CreateOrderPage() {
  await requireSystemPermission({ order: ["create"] })

  // The actions check the rate again when pricing; this only saves filling in a form that can't be sent
  const [rate, delivery, installation] = await Promise.all([getLatestExchangeRate(), getDeliverySettings(), getInstallationAreas()])

  return (
    <main className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Create Order</h1>
        <p className="text-sm text-muted-foreground">
          An order for a customer, from any store, priced as the storefront would price it, with installation where it&apos;s offered. It starts unpaid: record the payment when it arrives.
        </p>
      </div>

      {!rate || rate.isStale ? (
        <Card>
          <CardHeader>
            <CardTitle>Orders can&apos;t be priced right now</CardTitle>
            <CardDescription>
              {`Prices are converted from USD at the latest exchange rate, and ${rate ? `the latest one is more than ${EXCHANGE_RATE_MAX_AGE_DAYS} days old` : "no rate has been set"}. Ask a superAdmin to set today's rate in Settings.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/orders" className={buttonVariants({ variant: "outline" })}>
              Back to orders
            </Link>
          </CardContent>
        </Card>
      ) : (
        <CreateOrderForm delivery={delivery} installationAreas={installation.areas} />
      )}
    </main>
  )
}
