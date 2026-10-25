import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatDate } from "@workspace/utils/date"
import { BUSINESS_TYPE_LABELS } from "@workspace/commerce/trade-account-status"
import BackButton from "@/components/back-button"
import { OrderStatusBadge, PaymentStatusBadge, TradeAccountStatusBadge } from "@/components/order-badges"
import { Detail, ghs } from "@/components/orders/order-details"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getTradeAccount } from "@/lib/data/trade-accounts.data"
import TradeAccountReview from "./_components/trade-account-review"

export const metadata: Metadata = {
  title: "Trade Account",
}

type TradeAccountPageProps = {
  params: Promise<{ id: string }>
}

export default async function TradeAccountPage({ params }: TradeAccountPageProps) {
  await requireSystemPermission({ tradeAccount: ["read"] })

  const { id } = await params
  const response = await getTradeAccount(id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }
  const account = response.data

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-xl font-bold md:text-2xl">{account.companyName}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{`Applied ${formatDate(account.createdAt, "MMM d, yyyy")}`}</span>
            <TradeAccountStatusBadge status={account.status} />
          </div>
        </div>
        <BackButton link="/trade-accounts" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="grid auto-rows-max gap-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Company</CardTitle>
              <CardDescription>Verify the registration number and TIN before approving.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Detail label="Company name">{account.companyName}</Detail>
              <Detail label="Business">{BUSINESS_TYPE_LABELS[account.businessType]}</Detail>
              <Detail label="Registration number">{account.registrationNumber}</Detail>
              <Detail label="TIN">{account.tin}</Detail>
              <Detail label="Business phone">{account.phone}</Detail>
              <div className="sm:col-span-2">
                <Detail label="About the business">{account.details ?? <span className="text-muted-foreground">Not given</span>}</Detail>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
              <CardDescription>
                {account.orderCount === 0
                  ? "No orders yet."
                  : `${account.orderCount} ${account.orderCount === 1 ? "order" : "orders"}: ${ghs(account.ordersTotalGhs)}, ${ghs(account.discountGivenGhs)} discounted. The latest:`}
              </CardDescription>
            </CardHeader>
            {account.recentOrders.length > 0 && (
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Placed</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.recentOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link href={`/orders/${order.id}/details`} className="font-mono text-xs hover:underline hover:underline-offset-4">
                            {order.reference}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(order.createdAt, "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <OrderStatusBadge status={order.status} />
                            <PaymentStatusBadge status={order.paymentStatus} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{ghs(order.totalGhs)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="grid auto-rows-max gap-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                {account.status === "PENDING"
                  ? "Approve it with a discount, or reject it with a reason."
                  : account.status === "APPROVED"
                    ? `${Number(account.discountPercent)}% off every order, before tax.`
                    : account.status === "SUSPENDED"
                      ? `Suspended: no discount until it's reinstated (it was ${Number(account.discountPercent)}%).`
                      : `Rejected: ${account.rejectionReason}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {account.reviewedAt && (
                <p className="text-sm text-muted-foreground">{`Last reviewed ${formatDate(account.reviewedAt, "MMM d, yyyy, h:mm a")}${account.reviewedBy ? ` by ${account.reviewedBy}` : ""}.`}</p>
              )}
              <TradeAccountReview account={account} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>The storefront account that applied.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Detail label="Name">{account.customer.name ?? <span className="text-muted-foreground">Not given</span>}</Detail>
              <Detail label="Email">{account.customer.email}</Detail>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
