import type { Metadata } from "next"
import Link from "next/link"
import { MessageSquareText, Package, PenLine } from "lucide-react"
import { productsToReview } from "@workspace/commerce/reviews"
import { prisma } from "@workspace/db"
import { ReviewStatus } from "@workspace/db/enums"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { formatDate } from "@workspace/utils/date"

import { Stars } from "@/components/reviews/stars"
import { getAccountReviews } from "@/lib/data/reviews"
import { requireCustomer } from "@/lib/session"

export const metadata: Metadata = { title: "Reviews", robots: { index: false } }

function ProductImage({ url, name }: { url: string | null; name: string }) {
  return (
    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted" title={name}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
        <img src={url} alt="" className="size-full object-contain p-1" />
      ) : (
        <Package className="size-5 text-muted-foreground/40" aria-hidden />
      )}
    </div>
  )
}

// What the customer can review (products from orders that have reached them) and the reviews they've written
export default async function AccountReviewsPage() {
  const session = await requireCustomer("/account/reviews")
  const [toReview, reviews] = await Promise.all([productsToReview(prisma, session.user), getAccountReviews(session.user.id)])

  if (toReview.length === 0 && reviews.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <MessageSquareText className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nothing to review yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Once an order reaches you, its products show here for you to review.
            {!session.user.emailVerified && " Orders placed as a guest count once your email is confirmed."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {toReview.length > 0 && (
        <section aria-labelledby="to-review" className="flex flex-col gap-3">
          <h2 id="to-review" className="font-semibold">
            To review
          </h2>
          <ul className="flex flex-col gap-3">
            {toReview.map((product) => (
              <li key={product.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-4">
                    <ProductImage url={product.image} name={product.name} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link href={`/p/${product.slug}`} className="font-medium hover:underline hover:underline-offset-4">
                        {product.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        Ordered {formatDate(product.boughtOn, "d MMM yyyy")}
                        {product.variantLabel && ` · ${product.variantLabel}`}
                      </p>
                    </div>
                    <Button render={<Link href={`/account/reviews/${product.slug}`} />} size="sm">
                      <PenLine data-icon="inline-start" aria-hidden />
                      Write a review
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviews.length > 0 && (
        <section aria-labelledby="your-reviews" className="flex flex-col gap-3">
          <h2 id="your-reviews" className="font-semibold">
            Your reviews
          </h2>
          <ul className="flex flex-col gap-3">
            {reviews.map((review) => (
              <li key={review.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-4">
                      <ProductImage url={review.product.images[0] ?? null} name={review.product.name} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <Link href={`/p/${review.product.slug}#reviews`} className="font-medium hover:underline hover:underline-offset-4">
                          {review.product.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <Stars rating={review.rating} />
                          <span>{formatDate(review.createdAt, "d MMM yyyy")}</span>
                          {review.status === ReviewStatus.HIDDEN && <Badge variant="outline">Hidden</Badge>}
                        </div>
                      </div>
                      <Button render={<Link href={`/account/reviews/${review.product.slug}`} />} variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      <p className="font-medium">{review.title}</p>
                      <p className="line-clamp-3 whitespace-pre-line text-muted-foreground">{review.body}</p>
                    </div>
                    {review.status === ReviewStatus.HIDDEN && (
                      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">We&apos;ve hidden this review from the product&apos;s page: {review.hiddenReason}</p>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
