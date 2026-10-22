import "server-only"

import { unstable_cache } from "next/cache"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { ReviewStatus } from "@workspace/db/enums"

// A product's published reviews, as its page shows them. Cached for a minute, like the rest of the storefront; the
// author's own account pages read theirs straight from the database.

export const REVIEW_SORTS = ["newest", "highest", "lowest"] as const
export type ReviewSort = (typeof REVIEW_SORTS)[number]
export const REVIEW_SORT_LABELS: Record<ReviewSort, string> = { newest: "Newest", highest: "Highest rated", lowest: "Lowest rated" }

export const REVIEWS_PAGE_SIZE = 10

// "Kwame Mensah" shows as "Kwame M.": enough to be a person, not enough to find them
export function reviewerName(name: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "Customer"
  return parts.length === 1 ? parts[0]! : `${parts[0]} ${parts.at(-1)![0]!.toUpperCase()}.`
}

const ORDER_BY: Record<ReviewSort, Prisma.ReviewOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  highest: [{ rating: "desc" }, { createdAt: "desc" }],
  lowest: [{ rating: "asc" }, { createdAt: "desc" }],
}

// The average and count, as Product keeps them, and how many reviews gave each rating, 5 down to 1
export const getReviewSummary = unstable_cache(
  async (productId: string) => {
    const [product, groups] = await Promise.all([
      prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { rating: true, numReviews: true } }),
      prisma.review.groupBy({ by: ["rating"], where: { productId, status: ReviewStatus.PUBLISHED }, _count: true }),
    ])
    const counts = new Map(groups.map((group) => [group.rating, group._count]))
    return {
      average: product.rating.toFixed(1),
      count: product.numReviews,
      breakdown: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: counts.get(rating) ?? 0 })),
    }
  },
  ["store-review-summary"],
  { revalidate: 60 }
)

export type ReviewSummary = Awaited<ReturnType<typeof getReviewSummary>>

export const getProductReviews = unstable_cache(
  async (productId: string, sort: ReviewSort, page: number) => {
    const where = { productId, status: ReviewStatus.PUBLISHED }
    const total = await prisma.review.count({ where })
    const pageCount = Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE))
    const current = Math.min(Math.max(1, page), pageCount)
    const reviews = await prisma.review.findMany({
      where,
      orderBy: ORDER_BY[sort],
      skip: (current - 1) * REVIEWS_PAGE_SIZE,
      take: REVIEWS_PAGE_SIZE,
      select: { id: true, rating: true, title: true, body: true, variantLabel: true, createdAt: true, user: { select: { name: true } } },
    })
    return {
      total,
      page: current,
      pageCount,
      reviews: reviews.map(({ user, createdAt, ...review }) => ({ ...review, author: reviewerName(user.name), createdAt: createdAt.toISOString() })),
    }
  },
  ["store-product-reviews"],
  { revalidate: 60 }
)

export type ProductReview = Awaited<ReturnType<typeof getProductReviews>>["reviews"][number]

// The signed-in customer's own reviews, hidden ones included (with the reason), newest first
export async function getAccountReviews(userId: string) {
  return prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      variantLabel: true,
      status: true,
      hiddenReason: true,
      createdAt: true,
      product: { select: { id: true, name: true, slug: true, images: true } },
    },
  })
}
