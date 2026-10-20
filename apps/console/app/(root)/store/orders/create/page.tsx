import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { EXCHANGE_RATE_MAX_AGE_DAYS, getLatestExchangeRate } from "@workspace/commerce/exchange-rates"
import CreateOrderForm from "./_components/create-order-form"

export const metadata: Metadata = {
  title: "Create Order",
}

export default async function CreateStoreOrderPage() {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["create"] }).success) redirect("/forbidden")

  // The actions check again when pricing; this only saves filling in a form that can't be saved
  const rate = await getLatestExchangeRate()

  return (
    <main className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Create Order</h1>
        <p className="text-sm text-muted-foreground">An order taken in the store: at the counter, by phone or by message.</p>
      </div>

      {!rate || rate.isStale ? (
        <Card>
          <CardHeader>
            <CardTitle>Orders can&apos;t be priced right now</CardTitle>
            <CardDescription>
              {`Prices are converted from USD at the latest exchange rate, and ${rate ? `the latest one is more than ${EXCHANGE_RATE_MAX_AGE_DAYS} days old` : "no rate has been set"}. Ask a platform admin to set today's rate in Settings.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/store/orders" className={buttonVariants({ variant: "outline" })}>
              Back to orders
            </Link>
          </CardContent>
        </Card>
      ) : (
        <CreateOrderForm storeId={storeId} />
      )}
    </main>
  )
}
