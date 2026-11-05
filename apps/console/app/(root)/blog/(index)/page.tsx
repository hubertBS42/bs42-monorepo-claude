import type { Metadata } from "next"
import { Status } from "@workspace/db/enums"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import AddButton from "@/components/add-button"
import { requireConsoleAdmin } from "@/lib/auth-guard"
import { BLOG_POST_SORT_FIELDS, getBlogPosts, MAX_BLOG_POSTS_PAGE_SIZE } from "@/lib/data/blog.data"
import type { BlogPostsParams } from "@/types"
import BlogTable from "../_components/blog-table"

export const metadata: Metadata = {
  title: "Blog",
}

type BlogPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  await requireConsoleAdmin()
  const params = await searchParams

  const blogParams: BlogPostsParams = {
    search: getStringParam(params.search),
    status: getEnumParam(params.status, Object.values(Status)),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_BLOG_POSTS_PAGE_SIZE),
    sort: getSortParam(params.sort, BLOG_POST_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const result = await getBlogPosts(blogParams)
  if (!result.success) throw new Error(result.error)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Blog</h1>
          <p className="text-sm text-muted-foreground">Posts on the storefront&apos;s blog.</p>
        </div>

        <AddButton label="Add Post" url="/blog/add" />
      </div>
      <BlogTable data={result.data} />
    </div>
  )
}
