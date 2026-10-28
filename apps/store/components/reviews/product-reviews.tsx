import Link from "next/link"
import { MessageSquareText, PenLine } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { formatDate } from "@workspace/utils/date"
import { cn } from "@workspace/ui/lib/utils"

import { Stars } from "@/components/reviews/stars"
import { REVIEW_SORT_LABELS, REVIEW_SORTS, type ProductReview, type ReviewSort, type ReviewSummary } from "@/lib/data/reviews"
import { EmptyState } from "@workspace/ui/components/empty-state"

interface ProductReviewsProps {
  productSlug: string
  summary: ReviewSummary
  reviews: ProductReview[]
  sort: ReviewSort
  page: number
  pageCount: number
  // The page's URL with the reviews' sort and page set (the rest of the query kept)
  href: (change: { sort?: ReviewSort; page?: number }) => string
}

// The product page's reviews: the average with a bar per rating, then the reviews, sorted and paged by links
export function ProductReviews({ productSlug, summary, reviews, sort, page, pageCount, href }: ProductReviewsProps) {
  const writeHref = `/account/reviews/${productSlug}`

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="mt-12 scroll-mt-24 border-t pt-8">
      <h2 id="reviews-heading" className="mb-6 text-xl font-bold tracking-tight">
        Reviews
      </h2>

      {summary.count === 0 ? (
        <EmptyState icon={MessageSquareText} title="No reviews yet" description="Bought this? Tell other customers what you think." className="rounded-xl border border-solid">
          <Button render={<Link href={writeHref} />} variant="outline" size="sm">
            <PenLine data-icon="inline-start" aria-hidden />
            Write a review
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[18rem_1fr] lg:gap-12">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold">{summary.average}</span>
              <div className="flex flex-col gap-1">
                <Stars rating={summary.average} className="text-lg" />
                <span className="text-sm text-muted-foreground">{summary.count === 1 ? "1 review" : `${summary.count} reviews`}</span>
              </div>
            </div>
            <ul className="flex flex-col gap-1.5">
              {summary.breakdown.map(({ rating, count }) => (
                <li key={rating} className="flex items-center gap-2 text-sm">
                  <span className="w-12 shrink-0 text-muted-foreground">{rating} star</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-amber-500" style={{ width: `${(count / summary.count) * 100}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-right text-muted-foreground tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
            <Button render={<Link href={writeHref} />} variant="outline">
              <PenLine data-icon="inline-start" aria-hidden />
              Write a review
            </Button>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <nav aria-label="Sort reviews" className="flex flex-wrap gap-1">
              {REVIEW_SORTS.map((value) => (
                <Link
                  key={value}
                  href={href({ sort: value, page: 1 })}
                  scroll={false}
                  aria-current={value === sort ? "true" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    value === sort && "bg-muted font-medium text-foreground"
                  )}
                >
                  {REVIEW_SORT_LABELS[value]}
                </Link>
              ))}
            </nav>

            <ul className="flex flex-col divide-y">
              {reviews.map((review) => (
                <li key={review.id} className="flex flex-col gap-2 py-5 first:pt-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars rating={review.rating} />
                    <h3 className="font-semibold normal-case">{review.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {review.author} · {formatDate(review.createdAt, "d MMM yyyy")}
                    {review.variantLabel && ` · Bought: ${review.variantLabel}`}
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{review.body}</p>
                </li>
              ))}
            </ul>

            {pageCount > 1 && (
              <nav aria-label="Review pages" className="flex items-center gap-3">
                {page > 1 ? (
                  <Button render={<Link href={href({ page: page - 1 })} scroll={false} />} variant="outline" size="sm">
                    Previous
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Previous
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  Page {page} of {pageCount}
                </span>
                {page < pageCount ? (
                  <Button render={<Link href={href({ page: page + 1 })} scroll={false} />} variant="outline" size="sm">
                    Next
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
                  </Button>
                )}
              </nav>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
