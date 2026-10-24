import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Detail } from "@/components/orders/order-details"
import type { ProductRequestForForm } from "@/lib/data/product-requests.data"

// On the add form, the store's request it answers: what they typed that the form couldn't take (a brand or category
// the catalogue doesn't have, or one products can't go in), their link and notes
export default function ProductRequestCard({ request }: { request: ProductRequestForForm }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Requested by {request.storeName}</CardTitle>
        <CardDescription>
          Saving tells the store it&apos;s been added.{" "}
          <Link href={`/catalogue/product-requests/${request.id}`} className="underline underline-offset-4 hover:text-foreground">
            View the request
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {request.brandName && !request.brandId && <Detail label="Brand they named">{`${request.brandName}: add it in Brands first if it's new`}</Detail>}
        {request.categoryName && !request.categoryId && <Detail label="Category they chose">{`${request.categoryName}: pick the most specific one under it`}</Detail>}
        {request.link && (
          <Detail label="Link">
            <a href={request.link} target="_blank" rel="noopener noreferrer" className="break-all underline-offset-4 hover:underline">
              {request.link}
            </a>
          </Detail>
        )}
        {request.notes && (
          <Detail label="Notes">
            <span className="whitespace-pre-line">{request.notes}</span>
          </Detail>
        )}
      </CardContent>
    </Card>
  )
}
