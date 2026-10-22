import Link from "next/link"
import { Star } from "lucide-react"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import type { ProductReviewStats } from "@/lib/data/reviews.data"

// The product edit page's rating as customers see it, with a link to its reviews
export function ProductReviewsCard({ productId, stats }: { productId: string; stats: ProductReviewStats }) {
  const total = stats.count + stats.hidden

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reviews</CardTitle>
        <CardDescription>
          {stats.count === 0 ? "No published reviews yet." : `Rated ${stats.average} out of 5 from ${stats.count === 1 ? "1 review" : `${stats.count} reviews`}.`}
          {stats.hidden > 0 && ` ${stats.hidden} hidden by staff.`}
        </CardDescription>
      </CardHeader>
      {total > 0 && (
        <CardContent>
          <Link href={`/catalogue/reviews?product=${productId}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
            <Star data-icon="inline-start" aria-hidden />
            View reviews
          </Link>
        </CardContent>
      )}
    </Card>
  )
}
