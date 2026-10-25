import type { Metadata } from "next"
import Link from "next/link"
import { ReviewStatus } from "@workspace/db/enums"
import { prisma } from "@workspace/db"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import { z } from "zod"
import ReviewsTable from "./_components/reviews-table"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getReviews, MAX_REVIEWS_PAGE_SIZE, REVIEW_SORT_FIELDS } from "@/lib/data/reviews.data"
import type { ReviewsParams } from "@/types"

export const metadata: Metadata = {
  title: "Reviews",
}

type ReviewsPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

// Customers' reviews of every product. Published at once; staff hide the ones that break the rules.
export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  await requireSystemPermission({ product: ["update"] })
  const params = await searchParams

  const rating = getPositiveIntegerParam(params.rating, 0, 5)
  // ?product= comes from a product's edit page and the low-rating email; the toolbar has no field for it
  const productParam = getStringParam(params.product)
  const productId = productParam && z.uuid().safeParse(productParam).success ? productParam : undefined
  const reviewsParams: ReviewsParams = {
    search: getStringParam(params.search),
    productId,
    rating: rating || undefined,
    status: getEnumParam(params.status, Object.values(ReviewStatus)),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_REVIEWS_PAGE_SIZE),
    sort: getSortParam(params.sort, REVIEW_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const [result, product] = await Promise.all([getReviews(reviewsParams), productId ? prisma.product.findUnique({ where: { id: productId }, select: { name: true } }) : null])
  if (!result.success) throw new Error(result.error)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Reviews</h1>
        <p className="text-sm text-muted-foreground">Reviews go live when posted. Hide any that break the rules.</p>
      </div>
      {product && (
        <p className="text-sm text-muted-foreground">
          Showing reviews of <span className="font-medium text-foreground">{product.name}</span>.{" "}
          <Link href="/catalogue/reviews" className="underline underline-offset-4 hover:text-foreground">
            Show all products
          </Link>
        </p>
      )}
      <ReviewsTable data={result.data} />
    </div>
  )
}
