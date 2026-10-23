import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import z from "zod"
import { ProductRequestStatus } from "@workspace/db/enums"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { formatDate } from "@workspace/utils/date"
import BackButton from "@/components/back-button"
import { ProductRequestStatusBadge } from "@/components/order-badges"
import { Detail } from "@/components/orders/order-details"
import { requireConsoleAdmin } from "@/lib/auth-guard"
import { getProductRequestDetails } from "@/lib/data/product-requests.data"
import ProductRequestReview from "./_components/product-request-review"

export const metadata: Metadata = {
  title: "Product Request",
}

type ProductRequestPageProps = {
  params: Promise<{ id: string }>
}

const notGiven = <span className="text-muted-foreground">Not given</span>

export default async function ProductRequestPage({ params }: ProductRequestPageProps) {
  await requireConsoleAdmin()

  const { id } = await params
  // A uuid column: anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getProductRequestDetails(id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }
  const request = response.data
  const decided = request.reviewedAt && `${formatDate(request.reviewedAt, "MMM d, yyyy")}${request.reviewedBy ? ` by ${request.reviewedBy}` : ""}`

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-xl font-bold md:text-2xl">{request.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{`Asked ${formatDate(request.createdAt, "MMM d, yyyy")} by ${request.requestedBy ?? "a former member"} in ${request.storeName}`}</span>
            <ProductRequestStatusBadge status={request.status} />
          </div>
        </div>
        <BackButton link="/catalogue/product-requests" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>What the store asked for</CardTitle>
            <CardDescription>As they typed it. Check the details before adding the product.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Detail label="Name">{request.name}</Detail>
            <Detail label="Brand">{request.brand ? (request.newBrand ? `${request.brand} (not in the catalogue)` : request.brand) : notGiven}</Detail>
            <Detail label="Category">{request.categoryPath ?? notGiven}</Detail>
            <Detail label="Barcode or part number">{request.barcode ?? notGiven}</Detail>
            <div className="sm:col-span-2">
              <Detail label="Link">
                {request.link ? (
                  <a href={request.link} target="_blank" rel="noopener noreferrer" className="break-all underline-offset-4 hover:underline">
                    {request.link}
                  </a>
                ) : (
                  notGiven
                )}
              </Detail>
            </div>
            <div className="sm:col-span-2">
              <Detail label="Notes">{request.notes ? <span className="whitespace-pre-line">{request.notes}</span> : notGiven}</Detail>
            </div>
            <Detail label="Asked by">{request.requestedBy ? `${request.requestedBy}${request.requestedByEmail ? ` (${request.requestedByEmail})` : ""}` : notGiven}</Detail>
            <Detail label="Store">{request.storeName}</Detail>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
            <CardDescription>
              {request.status === ProductRequestStatus.PENDING
                ? "Add the product, or link one the catalogue already has: either way the store is told, so it can list it."
                : request.status === ProductRequestStatus.CANCELLED
                  ? "The store withdrew this request."
                  : `Decided ${decided}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {request.status === ProductRequestStatus.PENDING ? (
              <ProductRequestReview request={{ id: request.id, name: request.name }} />
            ) : request.product ? (
              <Link href={`/catalogue/products/${request.product.id}/edit`} className="text-sm font-medium underline-offset-4 hover:underline">
                {request.product.name}
              </Link>
            ) : request.declineReason ? (
              <Detail label="Reason">{request.declineReason}</Detail>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
