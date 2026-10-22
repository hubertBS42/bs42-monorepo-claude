import "server-only"

import { headers } from "next/headers"
import { consoleAuth } from "@workspace/auth/console"
import { formatError } from "@workspace/auth/format-error"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import type { DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { getPaginationError } from "@workspace/utils/pagination"
import { z } from "zod"

import type { ReviewsData, ReviewsParams } from "@/types"

export const MAX_REVIEWS_PAGE_SIZE = 100
export const REVIEW_SORT_FIELDS = ["createdAt", "rating"] as const

// Every product's reviews, for staff to read and hide (`/catalogue/reviews`), newest first
export const getReviews = async (filters: ReviewsParams = {}): Promise<DataResponse<ReviewsData>> => {
  try {
    const session = await consoleAuth.api.getSession({ headers: await headers() })
    if (!session || !hasSystemPermission(session.user.role, { product: ["update"] })) return { success: false, error: "Unauthorized" }

    const paginationError = getPaginationError(filters, { maxPageSize: MAX_REVIEWS_PAGE_SIZE, allowedSortFields: REVIEW_SORT_FIELDS })
    if (paginationError) return { success: false, error: paginationError }

    const { search, productId, rating, status, page = 1, pageSize = 10, sort, order } = filters
    const contains = search ? { contains: search, mode: "insensitive" as const } : undefined
    const where: Prisma.ReviewWhereInput = {
      ...(contains && { OR: [{ product: { name: contains } }, { user: { name: contains } }, { user: { email: contains } }, { title: contains }] }),
      ...(productId && z.uuid().safeParse(productId).success && { productId }),
      ...(rating && { rating }),
      ...(status && { status }),
    }
    // id breaks ties so rows with equal sort values keep their order across pages
    const orderBy = [sort ? { [sort]: order ?? "desc" } : { createdAt: "desc" as const }, { id: "asc" as const }]

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          variantLabel: true,
          status: true,
          hiddenReason: true,
          createdAt: true,
          hiddenBy: { select: { name: true } },
          product: { select: { id: true, name: true } },
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.review.count({ where }),
    ])

    return {
      success: true,
      data: {
        data: reviews.map(({ hiddenBy, user, ...review }) => ({ ...review, hiddenByName: hiddenBy?.name ?? null, customer: user })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// The product's rating as customers see it, and how many reviews staff have hidden, for its edit page
export async function getProductReviewStats(productId: string) {
  const [product, hidden] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { rating: true, numReviews: true } }),
    prisma.review.count({ where: { productId, status: "HIDDEN" } }),
  ])
  return { average: product?.rating.toFixed(1) ?? "0.0", count: product?.numReviews ?? 0, hidden }
}

export type ProductReviewStats = Awaited<ReturnType<typeof getProductReviewStats>>
