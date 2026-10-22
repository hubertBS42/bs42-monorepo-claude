import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Package } from "lucide-react"
import { canReview } from "@workspace/commerce/reviews"
import { prisma } from "@workspace/db"
import { ReviewStatus } from "@workspace/db/enums"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { ReviewForm } from "@/components/account/review-form"
import { requireCustomer } from "@/lib/session"

export const metadata: Metadata = { title: "Write a review", robots: { index: false } }

// Where the "How was it?" email and the product page's "Write a review" lead: the customer's review of the product,
// new or to edit. Only buyers get the form.
export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await requireCustomer(`/account/reviews/${slug}`)
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, images: true } })
  if (!product) notFound()

  const [review, eligible] = await Promise.all([
    prisma.review.findUnique({
      where: { userId_productId: { userId: session.user.id, productId: product.id } },
      select: { rating: true, title: true, body: true, status: true, hiddenReason: true },
    }),
    canReview(prisma, session.user, product.id),
  ])
  const image = product.images[0]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
            <img src={image} alt="" className="size-full object-contain p-1" />
          ) : (
            <Package className="size-6 text-muted-foreground/40" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <CardTitle>{review ? "Edit your review" : "Write a review"}</CardTitle>
          <CardDescription>
            <Link href={`/p/${product.slug}`} className="hover:underline hover:underline-offset-4">
              {product.name}
            </Link>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {review?.status === ReviewStatus.HIDDEN && (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            We&apos;ve hidden this review from the product&apos;s page: {review.hiddenReason} Editing it doesn&apos;t show it again.
          </p>
        )}
        {eligible ? (
          <ReviewForm
            productId={product.id}
            productSlug={product.slug}
            initial={review ? { rating: review.rating, title: review.title, body: review.body } : { rating: 0, title: "", body: "" }}
            isEdit={review !== null}
          />
        ) : (
          <div className="flex flex-col items-start gap-3 text-sm">
            <p className="text-muted-foreground">
              Only customers who bought it can review it, once their order has reached them. If you ordered it as a guest, sign in with the email you ordered with
              {session.user.emailVerified ? "" : " and confirm it"}, and it&apos;ll count.
            </p>
            <div className="flex gap-2">
              <Button render={<Link href="/account/orders" />} variant="outline" size="sm">
                My orders
              </Button>
              <Button render={<Link href={`/p/${product.slug}`} />} variant="ghost" size="sm">
                Back to the product
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
