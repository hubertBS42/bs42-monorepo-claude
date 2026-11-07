import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { EXCHANGE_RATE_MAX_AGE_DAYS, getLatestExchangeRate } from "@workspace/commerce/exchange-rates"
import { prisma } from "@workspace/db"
import { OrganizationStatus } from "@workspace/db/enums"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import CounterSaleForm from "./_components/counter-sale-form"

export const metadata: Metadata = {
  title: "Counter Sale",
}

export default async function CounterSalePage() {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["create"] }).success) redirect("/forbidden")

  // The action checks again when pricing; this only saves ringing up a sale that can't be saved
  const [rate, store] = await Promise.all([getLatestExchangeRate(), prisma.organization.findUnique({ where: { id: storeId }, select: { status: true } })])
  const suspended = store?.status !== OrganizationStatus.ACTIVE

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Counter Sale</h1>
        <p className="text-sm text-muted-foreground">A customer in the store, paying now and leaving with the goods.</p>
      </div>

      {suspended || !rate || rate.isStale ? (
        <Card>
          <CardHeader>
            <CardTitle>{suspended ? "This store can't take orders" : "Sales can't be priced right now"}</CardTitle>
            <CardDescription>
              {suspended
                ? "The store is suspended. Ask a platform admin."
                : `Prices are converted from USD at the latest exchange rate, and ${rate ? `the latest one is more than ${EXCHANGE_RATE_MAX_AGE_DAYS} days old` : "no rate has been set"}. Ask a platform admin to set today's rate in Settings.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/store/orders" className={buttonVariants({ variant: "outline" })}>
              Back to orders
            </Link>
          </CardContent>
        </Card>
      ) : (
        <CounterSaleForm storeId={storeId} />
      )}
    </div>
  )
}
